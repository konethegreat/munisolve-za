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
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createFakePrisma } = require('./fakePrisma');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

// Generated for this test process only, so no reusable credential lives in the source. The suffix
// keeps the password valid under the registration rules (upper case, lower case, digit, symbol).
const TEST_JWT_SECRET = crypto.randomBytes(32).toString('hex');
const TEST_PASSWORD = `${crypto.randomBytes(12).toString('hex')}Aa1!`;
const WRONG_PASSWORD = `${crypto.randomBytes(12).toString('hex')}Bb2?`;
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

function quietConsole() {
  if (process.env.TEST_VERBOSE) return;
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) console[method] = () => {};
}

let userCounter = 0;
let ipCounter = 0;

async function startApp() {
  quietConsole();

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.CLIENT_URL = `${TEST_CLIENT_ORIGIN}/`;
  delete process.env.JWT_EXPIRES_IN;

  const db = createFakePrisma();
  const anthropic = { calls: [], fail: false, reply: 'Stubbed assistant reply.' };
  const email = { sent: [] };
  const weather = { calls: [], result: null };

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

  stubModule(appPath('src/config/db.config.js'), db);
  stubModule(appPath('src/services/email.service.js'), {
    sendVerificationEmail: async (...args) => {
      email.sent.push(args);
    },
  });
  stubModule(appPath('src/services/weather.service.js'), {
    getWeatherForLocation: async (lat, lon) => {
      weather.calls.push([lat, lon]);
      return weather.result;
    },
  });
  stubModule(packagePath('dotenv'), { config: () => ({ parsed: {} }) });
  stubModule(packagePath('@anthropic-ai/sdk'), FakeAnthropic);
  stubModule(packagePath('google-auth-library'), { OAuth2Client: FakeOAuth2Client });

  const app = require(appPath('src/server.js'));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function api(method, route, { token, body, ip, headers } = {}) {
    ipCounter += 1;
    const response = await fetch(baseUrl + route, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip || `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`,
        ...(token && { authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
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
    weather.calls.length = 0;
    weather.result = null;
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
    weather,
    secret: TEST_JWT_SECRET,
    password: TEST_PASSWORD,
    wrongPassword: WRONG_PASSWORD,
    clientOrigin: TEST_CLIENT_ORIGIN,
  };
}

module.exports = { startApp, TEST_JWT_SECRET, TEST_PASSWORD, WRONG_PASSWORD };
