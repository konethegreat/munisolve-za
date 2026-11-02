'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('request validation', () => {
  let h;
  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => h.reset());

  test('stores names with apostrophes and hyphens verbatim', async () => {
    const res = await h.api('POST', '/api/auth/register', {
      body: {
        firstName: "O'Brien",
        lastName: 'Van Der Merwe-Smith',
        email: 'apostrophe@example.com',
        password: h.password,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(h.db.tables.user[0].firstName, "O'Brien");
    assert.equal(h.db.tables.user[0].lastName, 'Van Der Merwe-Smith');
  });

  test('strips unknown fields instead of trusting them', async () => {
    const res = await h.api('POST', '/api/auth/register', {
      body: {
        firstName: 'Thandi',
        lastName: 'Demo',
        email: 'strip.me@example.com',
        password: h.password,
        role: 'SUPER_ADMIN',
        isVerified: true,
        isActive: false,
        extra: 'ignored',
      },
    });

    assert.equal(res.status, 201);
    const stored = h.db.tables.user[0];
    assert.equal(stored.role, 'CITIZEN');
    assert.equal(stored.isVerified, false);
    assert.equal(stored.isActive, true);
    assert.ok(!('extra' in stored));
  });

  test('rejects invalid IDs with 400, not 500', async () => {
    const user = h.makeUser();
    const res = await h.api('GET', '/api/reports/not-a-number', { token: h.tokenFor(user) });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
    assert.equal(res.body.errors[0].field, 'id');
  });
});
