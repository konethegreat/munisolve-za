'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

const DAY = 24 * 60 * 60 * 1000;

describe('internal tick endpoint', () => {
  let h;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => h.reset());

  test('rejects a missing or wrong secret', async () => {
    const missing = await h.api('POST', '/api/internal/tick');
    assert.equal(missing.status, 401);
    assert.equal(missing.body.errorCode, 'UNAUTHORIZED');

    const wrong = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': 'not-the-secret' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.errorCode, 'UNAUTHORIZED');
  });

  test('returns 503 when no secret is configured', async () => {
    const saved = process.env.TICK_SECRET;
    delete process.env.TICK_SECRET;
    try {
      const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': '' } });
      assert.equal(res.status, 503);
      assert.equal(res.body.errorCode, 'TICK_NOT_CONFIGURED');
    } finally {
      process.env.TICK_SECRET = saved;
    }
  });

  test('runs with the correct secret and returns counts only', async () => {
    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, {
      enqueued: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      autoAssigned: 0,
      decisions: 0,
      webhooksSent: 0,
      webhooksFailed: 0,
    });
    assert.equal(JSON.stringify(res.body).includes(h.tickSecret), false);
  });

  test('enqueues and emails an overdue report', async () => {    const owner = h.makeUser({ email: 'citizen@example.com' });
    h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
    const now = Date.now();
    h.makeReport(owner, {
      status: 'PENDING',
      createdAt: new Date(now - 2 * DAY),
      responseDueAt: new Date(now - 60 * 60 * 1000),
      resolutionDueAt: new Date(now + DAY),
      slaCycleStartedAt: new Date(now - 2 * DAY),
    });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.enqueued, 2);
    assert.equal(res.body.data.sent, 2);
    assert.deepEqual(h.notifications.map((message) => message.to).sort(), ['admin@example.com', 'citizen@example.com']);
    assert.equal(h.db.tables.notificationOutbox.length, 2);
    assert.ok(h.db.tables.notificationOutbox.every((row) => row.status === 'SENT'));
  });

  test('fails a webhook delivery aimed at a private address', async () => {
    const subscription = h.db.add('webhookSubscription', {
      url: 'https://127.0.0.1/hook',
      events: '*',
      secret: 'whsec_test',
    });
    h.db.add('webhookDelivery', {
      subscriptionId: subscription.id,
      dedupeKey: 'private-target',
      event: 'report.created',
      payload: '{"event":"report.created"}',
    });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.webhooksSent, 0);
    assert.equal(res.body.data.webhooksFailed, 1);
    const delivery = h.db.tables.webhookDelivery[0];
    assert.equal(delivery.status, 'FAILED');
    assert.match(delivery.lastError, /PRIVATE_ADDRESS/);
  });
});
