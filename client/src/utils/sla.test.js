import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, slaDeadline, slaState } from './sla.js';

const NOW = new Date('2026-03-01T12:00:00.000Z').getTime();
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();
const HOUR = 60 * 60 * 1000;

test('pending unassigned reports use the response deadline', () => {
  const deadline = slaDeadline({
    status: 'PENDING',
    createdAt: iso(-HOUR),
    responseDueAt: iso(2 * HOUR),
    resolutionDueAt: iso(10 * HOUR),
  });

  assert.equal(deadline.kind, 'response');
});

test('assigned reports use the resolution deadline', () => {
  const deadline = slaDeadline({
    status: 'ASSIGNED',
    assignedAt: iso(-HOUR),
    responseDueAt: iso(-2 * HOUR),
    resolutionDueAt: iso(4 * HOUR),
    slaCycleStartedAt: iso(-HOUR),
  });

  assert.equal(deadline.kind, 'resolution');
});

test('resolved reports have no SLA badge', () => {
  assert.equal(slaState({ status: 'RESOLVED', resolutionDueAt: iso(HOUR) }, NOW), null);
});

test('overdue reports report the amount overdue', () => {
  const state = slaState(
    {
      status: 'IN_PROGRESS',
      createdAt: iso(-10 * HOUR),
      slaCycleStartedAt: iso(-10 * HOUR),
      resolutionDueAt: iso(-3 * HOUR),
    },
    NOW,
  );

  assert.equal(state.tone, 'overdue');
  assert.equal(state.text, 'Resolution overdue by 3h');
});

test('deadlines inside the final 20 percent are warnings', () => {
  const state = slaState(
    {
      status: 'PENDING',
      createdAt: iso(-9 * HOUR),
      responseDueAt: iso(1 * HOUR),
    },
    NOW,
  );

  assert.equal(state.tone, 'warning');
  assert.equal(state.text, 'Response due in 1h');
});

test('comfortable deadlines stay ok', () => {
  const state = slaState(
    {
      status: 'IN_PROGRESS',
      createdAt: iso(-HOUR),
      slaCycleStartedAt: iso(-HOUR),
      resolutionDueAt: iso(48 * HOUR),
    },
    NOW,
  );

  assert.equal(state.tone, 'ok');
  assert.equal(state.text, 'Resolution due in 2d');
});

test('invalid dates do not produce a badge', () => {
  assert.equal(
    slaState({ status: 'PENDING', responseDueAt: 'not-a-date' }, NOW),
    null,
  );
});

test('formatDuration is compact and human readable', () => {
  assert.equal(formatDuration(30 * 60 * 1000), '30m');
  assert.equal(formatDuration(5 * HOUR), '5h');
  assert.equal(formatDuration(26 * HOUR), '1d 2h');
  assert.equal(formatDuration(-1), '0m');
});
