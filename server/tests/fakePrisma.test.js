'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakePrisma } = require('./helpers/fakePrisma');

function notification(overrides = {}) {
  return {
    dedupeKey: 'sla:TEST:r1:c0:person@example.com',
    kind: 'SLA_RESOLUTION_BREACH',
    recipientEmail: 'person@example.com',
    subject: 'Subject',
    body: 'Body',
    ...overrides,
  };
}

describe('fake Prisma Phase 2A support', () => {
  test('comparison filters select rows inside a date range', async () => {
    const db = createFakePrisma();
    const now = new Date('2026-11-02T12:00:00.000Z');
    db.add('notificationOutbox', notification({ nextAttemptAt: new Date('2026-11-02T11:00:00.000Z') }));
    db.add('notificationOutbox', notification({ dedupeKey: 'other', nextAttemptAt: new Date('2026-11-02T13:00:00.000Z') }));

    const rows = await db.notificationOutbox.findMany({ where: { nextAttemptAt: { lte: now } } });
    assert.equal(rows.length, 1);
  });

  test('OR selects either status', async () => {
    const db = createFakePrisma();
    const now = new Date('2026-11-02T12:00:00.000Z');
    db.add('notificationOutbox', notification({ status: 'PENDING', nextAttemptAt: now }));
    db.add('notificationOutbox', notification({ dedupeKey: 'b', status: 'SENDING', nextAttemptAt: now }));
    db.add('notificationOutbox', notification({ dedupeKey: 'c', status: 'SENT', nextAttemptAt: now }));

    const rows = await db.notificationOutbox.findMany({
      where: { OR: [{ status: 'PENDING' }, { status: 'SENDING' }], nextAttemptAt: { lte: now } },
    });
    assert.deepEqual(rows.map((row) => row.status).sort(), ['PENDING', 'SENDING']);
  });

  test('createMany skipDuplicates honours the dedupe key', async () => {
    const db = createFakePrisma();
    const first = await db.notificationOutbox.createMany({ data: [notification()], skipDuplicates: true });
    const second = await db.notificationOutbox.createMany({ data: [notification()], skipDuplicates: true });
    assert.equal(first.count, 1);
    assert.equal(second.count, 0);
    assert.equal(db.tables.notificationOutbox.length, 1);
  });

  test('deleting a report removes its notifications', async () => {
    const db = createFakePrisma();
    const user = db.add('user', { email: 'u@example.com', password: 'x', firstName: 'A', lastName: 'B' });
    const report = db.add('report', { title: 'T', description: 'D', category: 'POTHOLE', municipality: 'M', userId: user.id });
    db.add('notificationOutbox', notification({ reportId: report.id }));

    await db.report.delete({ where: { id: report.id } });
    assert.equal(db.tables.notificationOutbox.length, 0);
  });
});
