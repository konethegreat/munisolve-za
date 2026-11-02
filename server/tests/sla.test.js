'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SLA_POLICY,
  dueWarningAt,
  planSlaNotifications,
} = require('../src/domain/sla');

const NOW = new Date('2026-11-02T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CLIENT = 'https://client.example.test/';

function report(overrides = {}) {
  return {
    id: 7,
    title: 'Pothole on Main Road',
    category: 'POTHOLE',
    municipality: 'City of Johannesburg',
    status: 'PENDING',
    createdAt: new Date(NOW.getTime() - 5 * HOUR),
    assignedAt: null,
    responseDueAt: new Date(NOW.getTime() + HOUR),
    resolutionDueAt: new Date(NOW.getTime() + 10 * DAY),
    slaCycleStartedAt: new Date(NOW.getTime() - 5 * HOUR),
    reopenCount: 0,
    user: { email: 'citizen@example.com', firstName: 'Thandi' },
    ...overrides,
  };
}

const admins = [
  { email: 'admin@example.com', firstName: 'Ayanda' },
  { email: 'Admin@Example.com', firstName: 'Ayanda' },
];

function plan(reports, people = admins) {
  return planSlaNotifications({ now: NOW, reports, admins: people, clientUrl: CLIENT });
}

describe('SLA planner', () => {
  test('the defaults are 72 hours and 14 days', () => {
    assert.deepEqual(DEFAULT_SLA_POLICY, { responseMinutes: 4320, resolutionMinutes: 20160 });
  });

  test('the warning point is 80 percent of the window', () => {
    const start = new Date(0);
    const due = new Date(100_000);
    assert.equal(dueWarningAt(start, due).getTime(), 80_000);
  });

  test('a response warning goes to the owner only', () => {
    const drafts = plan([report()]);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, 'SLA_RESPONSE_WARNING');
    assert.equal(drafts[0].recipientEmail, 'citizen@example.com');
    assert.equal(drafts[0].dedupeKey, 'sla:SLA_RESPONSE_WARNING:r7:c0:citizen@example.com');
    assert.match(drafts[0].body, /https:\/\/client\.example\.test\/reports\/7/);
  });

  test('a response breach alerts the owner and each admin once', () => {
    const drafts = plan([
      report({ responseDueAt: new Date(NOW.getTime() - HOUR) }),
    ]);
    assert.deepEqual(
      drafts.map((draft) => [draft.kind, draft.recipientEmail]).sort(),
      [
        ['SLA_RESPONSE_BREACH', 'admin@example.com'],
        ['SLA_RESPONSE_BREACH', 'citizen@example.com'],
      ],
    );
  });

  test('an assigned report no longer has a response SLA', () => {
    const drafts = plan([
      report({
        status: 'ASSIGNED',
        assignedAt: new Date(NOW.getTime() - 2 * HOUR),
        responseDueAt: new Date(NOW.getTime() - HOUR),
      }),
    ]);
    assert.deepEqual(drafts, []);
  });

  test('a resolution warning uses the cycle start after a reopen', () => {
    const drafts = plan([
      report({
        status: 'IN_PROGRESS',
        assignedAt: new Date(NOW.getTime() - 3 * DAY),
        resolutionDueAt: new Date(NOW.getTime() + HOUR),
        slaCycleStartedAt: new Date(NOW.getTime() - 9 * HOUR),
        reopenCount: 2,
      }),
    ]);
    assert.deepEqual(drafts.map((draft) => [draft.kind, draft.dedupeKey]), [
      ['SLA_RESOLUTION_WARNING', 'sla:SLA_RESOLUTION_WARNING:r7:c2:citizen@example.com'],
    ]);
  });

  test('a resolution breach alerts admins and includes the cycle in the key', () => {
    const drafts = plan([
      report({
        status: 'IN_PROGRESS',
        assignedAt: new Date(NOW.getTime() - 3 * DAY),
        resolutionDueAt: new Date(NOW.getTime() - 1),
        reopenCount: 1,
      }),
    ]);
    assert.equal(drafts.length, 2);
    assert.ok(drafts.every((draft) => draft.kind === 'SLA_RESOLUTION_BREACH'));
    assert.ok(drafts.every((draft) => draft.dedupeKey.includes(':c1:')));
  });

  test('finished reports are ignored even when overdue', () => {
    for (const status of ['RESOLVED', 'CLOSED', 'REJECTED']) {
      const drafts = plan([
        report({
          status,
          responseDueAt: new Date(NOW.getTime() - DAY),
          resolutionDueAt: new Date(NOW.getTime() - DAY),
        }),
      ]);
      assert.deepEqual(drafts, [], `${status} must not notify`);
    }
  });

  test('an admin who owns the report is not emailed twice', () => {
    const drafts = plan(
      [report({ user: { email: 'admin@example.com', firstName: 'Ayanda' }, responseDueAt: new Date(NOW.getTime() - HOUR) })],
      [{ email: 'ADMIN@example.com', firstName: 'Ayanda' }],
    );
    assert.equal(drafts.length, 1);
  });

  test('reports without due dates are skipped', () => {
    const drafts = plan([report({ responseDueAt: null, resolutionDueAt: null })]);
    assert.deepEqual(drafts, []);
  });
});
