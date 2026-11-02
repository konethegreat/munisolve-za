'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakePrisma } = require('./helpers/fakePrisma');
const {
  enqueueNotifications,
  processOutbox,
  retryDelayMinutes,
  runTick,
} = require('../src/services/notification.service');

const NOW = new Date('2026-11-02T12:00:00.000Z');
const MINUTE = 60 * 1000;

function draft(overrides = {}) {
  return {
    dedupeKey: 'sla:SLA_RESOLUTION_BREACH:r7:c0:citizen@example.com',
    kind: 'SLA_RESOLUTION_BREACH',
    reportId: null,
    recipientEmail: 'citizen@example.com',
    subject: 'Report #7 is overdue',
    body: 'Your report is overdue.',
    ...overrides,
  };
}

function outbox(db) {
  return db.tables.notificationOutbox;
}

describe('notification outbox', () => {
  test('backoff starts at five minutes and caps at six hours', () => {
    assert.equal(retryDelayMinutes(1), 5);
    assert.equal(retryDelayMinutes(2), 10);
    assert.equal(retryDelayMinutes(3), 20);
    assert.equal(retryDelayMinutes(20), 360);
  });

  test('enqueueing the same draft twice stores one row', async () => {
    const db = createFakePrisma();
    assert.equal(await enqueueNotifications([draft()], NOW, db), 1);
    assert.equal(await enqueueNotifications([draft()], NOW, db), 0);
    assert.equal(outbox(db).length, 1);
    assert.equal(outbox(db)[0].status, 'PENDING');
  });

  test('a due row is sent once and marked SENT', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    const sent = [];

    const summary = await processOutbox({
      now: NOW,
      client: db,
      configured: true,
      send: async (message) => sent.push(message),
    });

    assert.deepEqual(summary, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'citizen@example.com');
    assert.equal(outbox(db)[0].status, 'SENT');
    assert.equal(outbox(db)[0].sentAt instanceof Date, true);
  });

  test('a failed send returns to PENDING with backoff, then succeeds later', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);

    const failed = await processOutbox({
      now: NOW,
      client: db,
      configured: true,
      send: async () => { throw new Error('provider down'); },
    });
    assert.deepEqual(failed, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
    assert.equal(outbox(db)[0].status, 'PENDING');
    assert.equal(outbox(db)[0].attempts, 1);
    assert.equal(outbox(db)[0].nextAttemptAt.getTime(), NOW.getTime() + 5 * MINUTE);
    assert.equal(outbox(db)[0].lastError, 'provider down');

    const tooEarly = await processOutbox({ now: new Date(NOW.getTime() + MINUTE), client: db, configured: true, send: async () => {} });
    assert.deepEqual(tooEarly, { claimed: 0, sent: 0, failed: 0, skipped: 0 });

    const later = await processOutbox({ now: new Date(NOW.getTime() + 6 * MINUTE), client: db, configured: true, send: async () => {} });
    assert.deepEqual(later, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
    assert.equal(outbox(db)[0].status, 'SENT');
  });

  test('the fifth failure is terminal', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    db.tables.notificationOutbox[0].attempts = 4;

    const summary = await processOutbox({
      now: NOW,
      client: db,
      configured: true,
      send: async () => { throw new Error('still down'); },
    });

    assert.deepEqual(summary, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
    assert.equal(outbox(db)[0].status, 'FAILED');
    assert.equal(outbox(db)[0].attempts, 5);
  });

  test('unconfigured email is recorded as SKIPPED, not retried', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    let calls = 0;

    const summary = await processOutbox({
      now: NOW,
      client: db,
      configured: false,
      send: async () => { calls += 1; },
    });

    assert.deepEqual(summary, { claimed: 1, sent: 0, failed: 0, skipped: 1 });
    assert.equal(calls, 0);
    assert.equal(outbox(db)[0].status, 'SKIPPED');
    assert.match(outbox(db)[0].lastError, /not configured/);
  });

  test('a SENDING row whose lease expired is reclaimed', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    db.tables.notificationOutbox[0].status = 'SENDING';
    db.tables.notificationOutbox[0].nextAttemptAt = new Date(NOW.getTime() - MINUTE);

    const summary = await processOutbox({ now: NOW, client: db, configured: true, send: async () => {} });
    assert.deepEqual(summary, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
  });

  test('the tick enqueues an overdue report and emails the owner and admins', async () => {
    const db = createFakePrisma();
    const owner = db.add('user', { email: 'citizen@example.com', password: 'x', firstName: 'Thandi', lastName: 'M', isVerified: true });
    const adminA = db.add('user', { email: 'admin.a@example.com', password: 'x', firstName: 'Ayanda', lastName: 'A', role: 'MUNICIPAL_ADMIN' });
    db.add('user', { email: 'super@example.com', password: 'x', firstName: 'Sipho', lastName: 'S', role: 'SUPER_ADMIN', isActive: false });
    db.add('report', {
      title: 'Burst pipe',
      description: 'Water is flooding the street.',
      category: 'WATER_LEAK',
      municipality: 'City of Tshwane',
      userId: owner.id,
      status: 'PENDING',
      createdAt: new Date(NOW.getTime() - 2 * 24 * 60 * MINUTE),
      responseDueAt: new Date(NOW.getTime() - 60 * MINUTE),
      resolutionDueAt: new Date(NOW.getTime() + 24 * 60 * MINUTE),
      slaCycleStartedAt: new Date(NOW.getTime() - 2 * 24 * 60 * MINUTE),
    });

    const sent = [];
    const summary = await runTick({
      now: NOW,
      client: db,
      configured: true,
      send: async (message) => sent.push(message),
      clientUrl: 'https://client.example.test',
    });

    assert.equal(summary.enqueued, 2);
    assert.equal(summary.sent, 2);
    assert.deepEqual(sent.map((message) => message.to).sort(), ['admin.a@example.com', 'citizen@example.com']);
    assert.ok(sent.every((message) => message.subject.startsWith('Report #1') || message.subject.startsWith('SLA breach')));
  });
});
