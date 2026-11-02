'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { canTransition, ALLOWED_TRANSITIONS } = require('../src/domain/reportStateMachine');

const report = (overrides = {}) => ({ id: 1, userId: 10, status: 'PENDING', afterPhotoUrl: null, ...overrides });
const decide = (overrides) => canTransition({ role: 'MUNICIPAL_ADMIN', actorId: 99, report: report(), nextStatus: 'IN_PROGRESS', ...overrides });

describe('report state machine', () => {
  test('allows exactly the documented canonical transitions', () => {
    assert.deepEqual(ALLOWED_TRANSITIONS, {
      PENDING: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'],
      ASSIGNED: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
      IN_PROGRESS: ['RESOLVED', 'REJECTED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: ['IN_PROGRESS'],
      REJECTED: ['PENDING'],
    });
  });

  test('rejects a jump outside the matrix with 409 INVALID_TRANSITION', () => {
    const decision = decide({ report: report({ status: 'PENDING' }), nextStatus: 'CLOSED' });

    assert.equal(decision.allowed, false);
    assert.equal(decision.statusCode, 409);
    assert.equal(decision.errorCode, 'INVALID_TRANSITION');
    assert.match(decision.message, /PENDING/);
    assert.match(decision.message, /CLOSED/);
  });

  test('citizens may only resolve their own PENDING or IN_PROGRESS report', () => {
    assert.equal(decide({ role: 'CITIZEN', actorId: 10, nextStatus: 'RESOLVED' }).allowed, true);
    assert.equal(decide({ role: 'CITIZEN', actorId: 10, report: report({ status: 'IN_PROGRESS' }), nextStatus: 'RESOLVED' }).allowed, true);

    const other = decide({ role: 'CITIZEN', actorId: 11, nextStatus: 'RESOLVED' });
    assert.equal(other.errorCode, 'REPORT_NOT_FOUND');
    assert.equal(other.statusCode, 404);

    const forbidden = decide({ role: 'CITIZEN', actorId: 10, nextStatus: 'IN_PROGRESS' });
    assert.equal(forbidden.errorCode, 'INSUFFICIENT_PERMISSIONS');
    assert.equal(forbidden.statusCode, 403);

    const assigned = decide({ role: 'CITIZEN', actorId: 10, report: report({ status: 'ASSIGNED' }), nextStatus: 'RESOLVED' });
    assert.equal(assigned.errorCode, 'INVALID_TRANSITION');
    assert.equal(assigned.statusCode, 409);
  });

  test('a supervisor needs an after-photo to resolve', () => {
    const missing = decide({ role: 'WORKER_SUPERVISOR', report: report({ status: 'IN_PROGRESS' }), nextStatus: 'RESOLVED' });
    assert.equal(missing.errorCode, 'AFTER_PHOTO_REQUIRED');
    assert.equal(missing.statusCode, 400);

    const supplied = decide({ role: 'WORKER_SUPERVISOR', report: report({ status: 'IN_PROGRESS' }), nextStatus: 'RESOLVED', afterPhotoUrl: 'https://example.com/after.jpg' });
    assert.equal(supplied.allowed, true);

    const stored = decide({ role: 'WORKER_SUPERVISOR', report: report({ status: 'IN_PROGRESS', afterPhotoUrl: 'https://example.com/after.jpg' }), nextStatus: 'RESOLVED' });
    assert.equal(stored.allowed, true);
  });

  test('only SUPER_ADMIN can force an invalid transition, and only with a long reason', () => {
    const admin = decide({ role: 'MUNICIPAL_ADMIN', nextStatus: 'CLOSED' });
    assert.equal(admin.errorCode, 'INVALID_TRANSITION');

    const noReason = decide({ role: 'SUPER_ADMIN', nextStatus: 'CLOSED' });
    assert.equal(noReason.errorCode, 'OVERRIDE_REASON_REQUIRED');
    assert.equal(noReason.statusCode, 400);

    const forced = decide({ role: 'SUPER_ADMIN', nextStatus: 'CLOSED', reason: 'Emergency closure approved' });
    assert.deepEqual(forced, { allowed: true, forced: true });
  });
});
