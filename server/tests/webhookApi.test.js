'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('admin webhook subscriptions', () => {
  let h;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => h.reset());

  function admin() {
    const user = h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
    return h.tokenFor(user);
  }

  test('only admins can manage webhooks', async () => {
    const citizen = h.tokenFor(h.makeUser());
    const supervisor = h.tokenFor(h.makeUser({ role: 'WORKER_SUPERVISOR' }));

    assert.equal((await h.api('GET', '/api/admin/webhooks', { token: citizen })).status, 403);
    assert.equal((await h.api('GET', '/api/admin/webhooks', { token: supervisor })).status, 403);
    assert.equal((await h.api('POST', '/api/admin/webhooks', {
      token: citizen,
      body: { url: 'https://hooks.example.com/a', events: ['report.created'] },
    })).status, 403);
  });

  test('rejects unsafe subscription URLs at creation', async () => {
    const token = admin();
    for (const url of [
      'http://hooks.example.com/a',
      'https://localhost/a',
      'https://127.0.0.1/a',
      'https://169.254.169.254/latest/meta-data',
      'https://user:pass@hooks.example.com/a',
    ]) {
      const res = await h.api('POST', '/api/admin/webhooks', {
        token,
        body: { url, events: ['report.created'] },
      });
      assert.equal(res.status, 400, url);
    }
  });

  test('creates, lists, updates, rotates and deletes a subscription', async () => {
    const token = admin();

    const created = await h.api('POST', '/api/admin/webhooks', {
      token,
      body: {
        url: 'https://hooks.example.com/munisolve',
        events: ['report.created', 'report.status_changed'],
        description: 'Integration test receiver',
      },
    });
    assert.equal(created.status, 201);
    assert.match(created.body.data.secret, /^whsec_[0-9a-f]{48}$/);
    const id = created.body.data.id;
    const firstSecret = created.body.data.secret;
    assert.deepEqual(created.body.data.events, ['report.created', 'report.status_changed']);

    const list = await h.api('GET', '/api/admin/webhooks', { token });
    assert.equal(list.status, 200);
    assert.equal(list.body.count, 1);
    assert.equal(list.body.data[0].secret, undefined);
    assert.equal(list.body.data[0].deliveryCount, 0);

    const updated = await h.api('PATCH', `/api/admin/webhooks/${id}`, {
      token,
      body: { isActive: false, events: ['report.merged'] },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.isActive, false);
    assert.deepEqual(updated.body.data.events, ['report.merged']);

    const rotated = await h.api('POST', `/api/admin/webhooks/${id}/rotate-secret`, { token });
    assert.equal(rotated.status, 200);
    assert.match(rotated.body.data.secret, /^whsec_[0-9a-f]{48}$/);
    assert.notEqual(rotated.body.data.secret, firstSecret);
    assert.equal(h.db.tables.webhookSubscription[0].secret, rotated.body.data.secret);

    const deliveries = await h.api('GET', `/api/admin/webhooks/${id}/deliveries`, { token });
    assert.equal(deliveries.status, 200);
    assert.deepEqual(deliveries.body.data, []);

    assert.equal((await h.api('DELETE', `/api/admin/webhooks/${id}`, { token })).status, 200);
    assert.equal((await h.api('DELETE', `/api/admin/webhooks/${id}`, { token })).status, 404);
    assert.equal(h.db.tables.webhookSubscription.length, 0);
  });

  test('a new report enqueues only the events a subscription asked for', async () => {
    const token = admin();
    await h.api('POST', '/api/admin/webhooks', {
      token,
      body: { url: 'https://hooks.example.com/created', events: ['report.created'] },
    });
    await h.api('POST', '/api/admin/webhooks', {
      token,
      body: { url: 'https://hooks.example.com/merged', events: ['report.merged'] },
    });

    const citizen = h.makeUser();
    const created = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Street light out on Webhook Road',
        description: 'A synthetic report used to check webhook enqueueing.',
        category: 'STREETLIGHT',
        municipality: 'City of Johannesburg',
      },
    });

    assert.equal(created.status, 201);
    assert.equal(h.db.tables.webhookDelivery.length, 1);
    const delivery = h.db.tables.webhookDelivery[0];
    assert.equal(delivery.event, 'report.created');
    assert.equal(delivery.subscriptionId, h.db.tables.webhookSubscription.find((row) => row.url.endsWith('/created')).id);
    const payload = JSON.parse(delivery.payload);
    assert.equal(payload.event, 'report.created');
    assert.equal(payload.report.id, created.body.data.id);
    assert.equal(payload.report.title, 'Street light out on Webhook Road');
  });
});
