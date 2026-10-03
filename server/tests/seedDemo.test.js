'use strict';

// The demo seed writes synthetic users with a shared password, so it must never run against a
// hosted database. These tests cover the checks that stop it; nothing here connects to a database.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { assertLocalOnly, requirePassword } = require('../prisma/seedDemo');

const ENV_KEYS = ['DATABASE_URL', 'NODE_ENV', 'DEMO_PASSWORD'];

describe('demo seed safety checks', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  test('accepts a database on this machine', () => {
    const local = [
      'postgresql://postgres@localhost:5432/munisolve?schema=public',
      'postgresql://postgres:placeholder@127.0.0.1:54329/demo',
      'postgres://user@[::1]:5432/demo',
      'postgresql://postgres@LOCALHOST/demo',
    ];

    for (const url of local) {
      process.env.DATABASE_URL = url;
      assert.doesNotThrow(() => assertLocalOnly(), url);
    }
  });

  test('refuses anything that is not clearly this machine', () => {
    const refused = [
      '', // empty
      'not a url',
      'postgresql://u:p@db.example.com:5432/x',
      'postgresql://u:p@localhost.example.com/x', // look-alike host name
      'postgresql://u:p@127.0.0.1.example.com/x',
      'postgresql://u:p@10.0.0.5:5432/x', // another machine on a private network
      'postgresql://u:p@0.0.0.0:5432/x',
      'postgresql://u:p@127.0.0.1:5432/x?host=db.example.com', // host override in the query
      'postgresql://u:p@localhost:5432/x?hostaddr=203.0.113.9',
    ];

    for (const url of refused) {
      process.env.DATABASE_URL = url;
      assert.throws(() => assertLocalOnly(), /DATABASE_URL|valid URL|this machine/, url);
    }
  });

  test('refuses when DATABASE_URL is not set', () => {
    assert.throws(() => assertLocalOnly(), /DATABASE_URL is not set/);
  });

  test('refuses NODE_ENV=production even for a local database', () => {
    process.env.DATABASE_URL = 'postgresql://postgres@localhost:5432/demo';
    process.env.NODE_ENV = 'production';

    assert.throws(() => assertLocalOnly(), /NODE_ENV=production/);
  });

  test('never repeats the database URL in its error messages', () => {
    process.env.DATABASE_URL = 'postgresql://someone:hunter2-placeholder@db.example.com:5432/private_db';

    assert.throws(
      () => assertLocalOnly(),
      (error) => !/hunter2|someone|private_db|db\.example\.com/.test(error.message)
    );
  });

  test('needs a DEMO_PASSWORD of at least 12 characters, and returns it unchanged', () => {
    assert.throws(() => requirePassword(), /DEMO_PASSWORD/);

    process.env.DEMO_PASSWORD = 'too-short';
    assert.throws(() => requirePassword(), /at least 12/);

    const longEnough = crypto.randomBytes(12).toString('hex');
    process.env.DEMO_PASSWORD = longEnough;
    assert.equal(requirePassword(), longEnough);
  });
});
