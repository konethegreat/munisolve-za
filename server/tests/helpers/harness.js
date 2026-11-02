'use strict';

// Test harness: loads the real Express app with every outside dependency replaced.
//
//   - the Prisma client (src/config/db.config.js) is an in-memory fake
//   - email, weather, Anthropic and Google auth are stubs, so nothing touches the network
//   - dotenv is neutralised, so a developer's local .env can never leak into a test run
//
// Node runs each test file in its own process, so every file gets a fresh app and fresh
// in-memory rate-limit counters. Requests carry a unique X-Forwarded-For address (the app
// sets "trust proxy"), which gives each request its own rate-limit bucket unless a test
// passes a fixed `ip` on purpose.

const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createFakePrisma } = require('./fakePrisma');

// Pin the environment at load time: a test file may import an application module (such as the
// error middleware) before startApp() runs, and src/logger.ts chooses its level when it is
// first imported. Setting this here keeps every test run's logger silent.
process.env.NODE_ENV = 'test';

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

// Generate credentials for this test process; no reusable credential belongs in source.
const TEST_JWT_SECRET = crypto.randomBytes(32).toString('hex');
const TEST_PASSWORD = `${crypto.randomBytes(16).toString('hex')}Aa1!`;
const TEST_TICK_SECRET = crypto.randomBytes(16).toString('hex');
const TEST_CLIENT_ORIGIN = 'https://client.example.test';

// Cost 4 keeps the suite fast; the app's bcrypt.compare works with any cost.
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

function stubModule(resolvedPath, exports) {
  const stub = new Module(resolvedPath, null);
  stub.filename = resolvedPath;
  stub.paths = [];
  stub.loaded = true;
  stub.exports = exports;
  require.cache[resolvedPath] = stub;
}

const appPath = (relative) => path.join(SERVER_ROOT, relative);
const packagePath = (name) => require.resolve(name, { paths: [SERVER_ROOT] });

// Source modules are TypeScript. Allow callers to keep naming the historical
// `.js` path while the stub is filed under the file the app actually loads.
const sourcePath = (relative) => {
  const jsPath = appPath(relative);
  if (fs.existsSync(jsPath)) return jsPath;
  const tsPath = jsPath.replace(/\.js$/, '.ts');
  if (fs.existsSync(tsPath)) return tsPath;
  throw new Error(`Test harness cannot resolve source module: ${relative}`);
};

function quietConsole() {
  if (process.env.TEST_VERBOSE) return;
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) console[method] = () => {};
}

let userCounter = 0;
let ipCounter = 0;

async function startApp() {
  quietConsole();

  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.TICK_SECRET = TEST_TICK_SECRET;
  // Only the stub sees this synthetic value; the real SDK is replaced below.
  process.env.ANTHROPIC_API_KEY = 'synthetic-test-only';
  process.env.CLIENT_URL = `${TEST_CLIENT_ORIGIN}/`;
  delete process.env.JWT_EXPIRES_IN;

  const db = createFakePrisma();
  const anthropic = { calls: [], fail: false, reply: 'Stubbed assistant reply.' };
  const email = { sent: [], notifications: [] };
  const weather = { calls: [], result: null };
  const geo = { searches: [], reverses: [] };

  class FakeAnthropic {
    constructor() {
      this.messages = {
        create: async (args) => {
          anthropic.calls.push(args);
          if (anthropic.fail) throw new Error('stub: the model is unavailable');
          return { content: [{ text: anthropic.reply }] };
        },
      };
    }
  }

  class FakeOAuth2Client {
    async verifyIdToken() {
      throw new Error('stub: Google is not reachable from tests');
    }
  }

  stubModule(sourcePath('src/config/db.config.js'), db);
  stubModule(sourcePath('src/services/email.service.js'), {
    sendVerificationEmail: async (...args) => {
      email.sent.push(args);
    },
    sendNotificationEmail: async (message) => {
      email.notifications.push(message);
    },
    isEmailConfigured: () => true,
  });
  stubModule(sourcePath('src/services/weather.service.js'), {
    getWeatherForLocation: async (lat, lon) => {
      weather.calls.push([lat, lon]);
      return weather.result;
    },
  });
  stubModule(sourcePath('src/services/geo.service.js'), {
    searchPlaces: async (query, options) => {
      geo.searches.push([query, options]);
      return {
        data: {
          results: [
            {
              displayName: `${query}, Johannesburg, South Africa`,
              latitude: -26.2041,
              longitude: 28.0473,
              category: 'place',
              type: 'city',
              boundingBox: null,
            },
          ],
          attribution: '© OpenStreetMap contributors, ODbL',
        },
        cached: false,
      };
    },
    reversePlace: async (lat, lon) => {
      geo.reverses.push([lat, lon]);
      return {
        data: {
          displayName: '1 Test Street, Johannesburg, South Africa',
          latitude: lat,
          longitude: lon,
          address: {
            houseNumber: '1',
            road: 'Test Street',
            suburb: 'Braamfontein',
            city: 'Johannesburg',
            municipality: 'City of Johannesburg',
            state: 'Gauteng',
            postcode: '2001',
            country: 'South Africa',
          },
          attribution: '© OpenStreetMap contributors, ODbL',
        },
        cached: false,
      };
    },
    ATTRIBUTION: '© OpenStreetMap contributors, ODbL',
  });
  stubModule(packagePath('dotenv'), { config: () => ({ parsed: {} }) });
  stubModule(packagePath('@anthropic-ai/sdk'), FakeAnthropic);
  stubModule(packagePath('google-auth-library'), { OAuth2Client: FakeOAuth2Client });

  const app = require(sourcePath('src/server.js'));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // `body` is JSON-encoded for convenience. `rawBody` is sent verbatim, so a test can
  // submit a deliberately malformed payload (for example `'{'`) unchanged.
  async function api(method, route, { token, body, rawBody, ip, headers } = {}) {
    ipCounter += 1;
    const response = await fetch(baseUrl + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip || `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`,
        ...(token && { authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON body (for example Express's default error page).
    }
    return { status: response.status, body: json, text, headers: response.headers };
  }

  // A signed token for a user. The app re-reads the role from the database, so overrides such as
  // `{ role: 'SUPER_ADMIN' }` only change what the token claims, not what the user is allowed to do.
  function tokenFor(user, { claims = {}, secret = TEST_JWT_SECRET, expiresIn = '1h' } = {}) {
    return jwt.sign({ userId: user.id, email: user.email, role: user.role, ...claims }, secret, { expiresIn });
  }

  // Inserts a verified, active user. Every user shares TEST_PASSWORD.
  function makeUser(overrides = {}) {
    userCounter += 1;
    return db.add('user', {
      email: `person${userCounter}@example.com`,
      password: PASSWORD_HASH,
      firstName: 'Test',
      lastName: `Person${userCounter}`,
      role: 'CITIZEN',
      isActive: true,
      isVerified: true,
      ...overrides,
    });
  }

  function makeReport(owner, overrides = {}) {
    return db.add('report', {
      title: 'Pothole on the test road',
      description: 'A synthetic report used by the tests.',
      category: 'POTHOLE',
      municipality: 'City of Johannesburg',
      userId: owner.id,
      ...overrides,
    });
  }

  function makeTeam(overrides = {}) {
    return db.add('team', { name: 'Test Roads Crew', specialization: 'Roads & Infrastructure', ...overrides });
  }

  // Empties the fake database and the stubs' recorded calls. Call it from beforeEach.
  function reset() {
    db.reset();
    email.sent.length = 0;
    email.notifications.length = 0;
    weather.calls.length = 0;
    weather.result = null;
    geo.searches.length = 0;
    geo.reverses.length = 0;
    anthropic.calls.length = 0;
    anthropic.fail = false;
    anthropic.reply = 'Stubbed assistant reply.';
  }

  async function close() {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }

  return {
    db,
    api,
    baseUrl,
    close,
    reset,
    tokenFor,
    makeUser,
    makeReport,
    makeTeam,
    anthropic,
    email,
    notifications: email.notifications,
    tickSecret: TEST_TICK_SECRET,
    weather,
    geo,
    secret: TEST_JWT_SECRET,
    password: TEST_PASSWORD,
    clientOrigin: TEST_CLIENT_ORIGIN,
  };
}

module.exports = { startApp, TEST_JWT_SECRET, TEST_PASSWORD };
