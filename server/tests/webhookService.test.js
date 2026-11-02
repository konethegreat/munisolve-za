'use strict';

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createFakePrisma } = require('./helpers/fakePrisma');
const {
  enqueueReportEvent,
  processWebhookDeliveries,
} = require('../src/services/webhook.service');

const NOW = new Date('2026-11-02T12:00:00.000Z');

function report(overrides = {}) {
  return {
    id: 9,
    title: 'Pothole on Main Road',
    category: 'POTHOLE',
    status: 'PENDING',
    municipality: 'City of Johannesburg',
    latitude: -26.2,
    longitude: 28.04,
    assignedTeamId: null,
    closureReason: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function publicResolver() {
  return async () => [{ address: '93.184.216.34', family: 4 }];
}

describe('webhook service', () => {
  let db;
  beforeEach(() => {
    db = createFakePrisma();
  });

  test('enqueues one delivery per active subscription that wants the event', async () => {
    db.add('webhookSubscription', { url: 'https://hooks.example.com/a', events: 'report.created,report.merged', secret: 's1' });
    db.add('webhookSubscription', { url: 'https://hooks.example.com/b', events: 'report.created', secret: 's2' });
    db.add('webhookSubscription', { url: 'https://hooks.example.com/off', events: 'report.created', secret: 's3', isActive: false });

    const count = await enqueueReportEvent({ event: 'report.created', report: report(), now: NOW, client: db });

    assert.equal(count, 2);
    assert.equal(db.tables.webhookDelivery.length, 2);
    const payload = JSON.parse(db.tables.webhookDelivery[0].payload);
    assert.equal(payload.event, 'report.created');
    assert.equal(payload.report.id, 9);
    assert.equal(payload.occurredAt, NOW.toISOString());
  });

  test('signs and delivers a pending webhook', async () => {
    const subscription = db.add('webhookSubscription', {
      url: 'https://hooks.example.com/munisolve',
      events: 'report.created',
      secret: 'whsec_abc',
    });
    await enqueueReportEvent({ event: 'report.created', report: report(), now: NOW, client: db });
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return new Response('ok', { status: 200 });
    };

    const summary = await processWebhookDeliveries({
      now: NOW,
      client: db,
      fetchImpl,
      resolveHost: publicResolver(),
    });

    assert.equal(summary.sent, 1);
    assert.equal(summary.failed, 0);
    const delivery = db.tables.webhookDelivery[0];
    assert.equal(delivery.status, 'SENT');
    assert.equal(delivery.responseStatus, 200);
    assert.ok(delivery.deliveredAt);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, subscription.url);
    assert.equal(calls[0].options.redirect, 'error');
    const headers = calls[0].options.headers;
    assert.equal(headers['X-MuniSolve-Event'], 'report.created');
    assert.equal(headers['X-MuniSolve-Delivery'], String(delivery.id));
    const expected = crypto
      .createHmac('sha256', 'whsec_abc')
      .update(`${headers['X-MuniSolve-Timestamp']}.${delivery.payload}`)
      .digest('hex');
    assert.equal(headers['X-MuniSolve-Signature'], `sha256=${expected}`);
  });

  test('retries a 5xx response and fails a 4xx permanently', async () => {
    db.add('webhookSubscription', { url: 'https://hooks.example.com/a', events: '*', secret: 's' });
    await enqueueReportEvent({ event: 'report.created', report: report({ id: 1 }), now: NOW, client: db });
    await enqueueReportEvent({ event: 'report.created', report: report({ id: 2 }), now: NOW, client: db });

    const statuses = [503, 400];
    const summary = await processWebhookDeliveries({
      now: NOW,
      client: db,
      fetchImpl: async () => new Response('nope', { status: statuses.shift() }),
      resolveHost: publicResolver(),
    });

    assert.equal(summary.sent, 0);
    assert.equal(summary.failed, 2);
    const [retry, permanent] = db.tables.webhookDelivery;
    assert.equal(retry.status, 'PENDING');
    assert.equal(retry.attempts, 1);
    assert.ok(retry.nextAttemptAt > NOW);
    assert.equal(permanent.status, 'FAILED');
    assert.equal(permanent.attempts, 1);
    assert.match(permanent.lastError, /HTTP 400/);
  });

  test('blocks a private address at delivery time without calling fetch', async () => {
    db.add('webhookSubscription', { url: 'https://internal.example.com/hook', events: '*', secret: 's' });
    await enqueueReportEvent({ event: 'report.created', report: report(), now: NOW, client: db });

    let called = false;
    const summary = await processWebhookDeliveries({
      now: NOW,
      client: db,
      fetchImpl: async () => { called = true; return new Response('ok', { status: 200 }); },
      resolveHost: async () => [{ address: '10.0.0.5', family: 4 }],
    });

    assert.equal(called, false);
    assert.equal(summary.failed, 1);
    const delivery = db.tables.webhookDelivery[0];
    assert.equal(delivery.status, 'FAILED');
    assert.match(delivery.lastError, /PRIVATE_ADDRESS/);
  });

  test('fails a delivery whose subscription was deactivated', async () => {
    const subscription = db.add('webhookSubscription', {
      url: 'https://hooks.example.com/a',
      events: '*',
      secret: 's',
      isActive: false,
    });
    db.add('webhookDelivery', {
      subscriptionId: subscription.id,
      dedupeKey: 'fixed',
      event: 'report.created',
      payload: '{}',
    });

    const summary = await processWebhookDeliveries({
      now: NOW,
      client: db,
      fetchImpl: async () => new Response('ok', { status: 200 }),
      resolveHost: publicResolver(),
    });

    assert.equal(summary.failed, 1);
    assert.equal(db.tables.webhookDelivery[0].status, 'FAILED');
    assert.match(db.tables.webhookDelivery[0].lastError, /SUBSCRIPTION_INACTIVE/);
  });
});
