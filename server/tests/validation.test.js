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

  test('report creation returns field errors and strips ownership and status', async () => {
    const user = h.makeUser();
    const bad = await h.api('POST', '/api/reports', {
      token: h.tokenFor(user),
      body: { title: 'short', description: 'short', category: 'NOT_A_CATEGORY', municipality: 'J' },
    });

    assert.equal(bad.status, 400);
    assert.equal(bad.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(bad.body.errors.some((error) => error.field === 'title'));
    assert.ok(bad.body.errors.some((error) => error.field === 'category'));

    const good = await h.api('POST', '/api/reports', {
      token: h.tokenFor(user),
      body: {
        title: 'Pothole on Validation Road',
        description: 'A deep pothole that needs a proper patch.',
        category: 'POTHOLE',
        municipality: 'City of Johannesburg',
        status: 'RESOLVED',
        userId: user.id + 99,
      },
    });
    assert.equal(good.status, 201);
    assert.equal(good.body.data.status, 'PENDING');
    assert.equal(good.body.data.userId, user.id);
  });

  test('report list queries reject an out-of-range limit', async () => {
    const user = h.makeUser();
    const res = await h.api('GET', '/api/reports?limit=101', { token: h.tokenFor(user) });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
  });
});
