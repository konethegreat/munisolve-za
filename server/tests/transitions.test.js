'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('report transitions', () => {
  let h;
  let citizen;
  let supervisor;
  let admin;
  let superAdmin;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => {
    h.reset();
    citizen = h.makeUser({ email: 'citizen@example.com' });
    supervisor = h.makeUser({ email: 'supervisor@example.com', role: 'WORKER_SUPERVISOR' });
    admin = h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
    superAdmin = h.makeUser({ email: 'super@example.com', role: 'SUPER_ADMIN' });
  });

  const as = (user) => h.tokenFor(user);
  const history = (reportId) => h.db.tables.reportStatusHistory.filter((row) => row.reportId === reportId);
  const actions = (reportId) => h.db.tables.activityLog
    .filter((log) => log.entity === 'Report' && log.entityId === reportId)
    .map((log) => log.action);

  test('a citizen resolution writes history and the existing activity action', async () => {
    const report = h.makeReport(citizen, { status: 'PENDING' });

    const res = await h.api('PATCH', `/api/reports/${report.id}/status`, {
      token: as(citizen),
      body: { status: 'RESOLVED', note: 'Fixed, thanks' },
      headers: { 'x-request-id': 'test-request-1234' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'RESOLVED');
    assert.deepEqual(history(report.id).map((row) => [row.fromStatus, row.toStatus]), [['PENDING', 'RESOLVED']]);
    assert.deepEqual(actions(report.id), ['UPDATE_STATUS']);

    // The audit row is correlated with the inbound request and carries the caller's origin.
    const activity = h.db.tables.activityLog.find((log) => log.action === 'UPDATE_STATUS');
    assert.equal(activity.requestId, 'test-request-1234');
    assert.equal(typeof activity.ipAddress, 'string');
    assert.ok(activity.ipAddress.length > 0);
    assert.notEqual(activity.userAgent, undefined);
  });

  test('a supervisor uses the same service and history, with REPORT_STATUS_CHANGED', async () => {
    const report = h.makeReport(citizen, { status: 'PENDING' });

    const started = await h.api('PATCH', `/api/supervisor/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'IN_PROGRESS' },
    });
    assert.equal(started.status, 200);

    const resolved = await h.api('PATCH', `/api/supervisor/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'RESOLVED', afterPhotoUrl: 'https://example.com/after.jpg', note: 'Patched' },
    });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.data.afterPhotoUrl, 'https://example.com/after.jpg');
    assert.deepEqual(history(report.id).map((row) => [row.fromStatus, row.toStatus]), [
      ['PENDING', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'RESOLVED'],
    ]);
    assert.deepEqual(actions(report.id), ['REPORT_STATUS_CHANGED', 'REPORT_STATUS_CHANGED']);
  });

  test('an invalid jump returns 409 INVALID_TRANSITION and changes nothing', async () => {
    const report = h.makeReport(citizen, { status: 'PENDING' });

    const res = await h.api('PATCH', `/api/admin/reports/${report.id}/status`, {
      token: as(admin),
      body: { status: 'CLOSED' },
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.errorCode, 'INVALID_TRANSITION');
    assert.equal(h.db.tables.report[0].status, 'PENDING');
    assert.equal(history(report.id).length, 0);
    assert.equal(actions(report.id).length, 0);
  });

  test('a SUPER_ADMIN force override needs a reason and is audited as OVERRIDE_STATUS', async () => {
    const report = h.makeReport(citizen, { status: 'PENDING' });

    const refused = await h.api('PATCH', `/api/admin/reports/${report.id}/status`, {
      token: as(superAdmin),
      body: { status: 'CLOSED' },
    });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.errorCode, 'OVERRIDE_REASON_REQUIRED');

    const forced = await h.api('PATCH', `/api/admin/reports/${report.id}/status`, {
      token: as(superAdmin),
      body: { status: 'CLOSED', reason: 'Emergency closure approved' },
    });
    assert.equal(forced.status, 200);
    assert.equal(h.db.tables.report[0].status, 'CLOSED');
    assert.deepEqual(actions(report.id), ['OVERRIDE_STATUS']);
    assert.equal(history(report.id).length, 1);
  });

  test('assignment writes ASSIGNED history and keeps REPORT_ASSIGNED', async () => {
    const report = h.makeReport(citizen, { status: 'PENDING' });
    const team = h.makeTeam();

    const res = await h.api('PATCH', `/api/supervisor/reports/${report.id}/assign`, {
      token: as(supervisor),
      body: { teamId: team.id, note: 'Closest crew' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'ASSIGNED');
    assert.ok(res.body.data.assignedAt);
    assert.deepEqual(history(report.id).map((row) => [row.fromStatus, row.toStatus]), [['PENDING', 'ASSIGNED']]);
    assert.deepEqual(actions(report.id), ['REPORT_ASSIGNED']);
  });

  test('another citizen asking for ASSIGNED gets the same 404 as a missing report', async () => {
    const otherCitizen = h.makeUser({ email: 'other-citizen@example.com' });
    const report = h.makeReport(citizen, { status: 'PENDING' });

    const res = await h.api('PATCH', `/api/reports/${report.id}/status`, {
      token: as(otherCitizen),
      body: { status: 'ASSIGNED' },
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.errorCode, 'REPORT_NOT_FOUND');
    assert.equal(h.db.tables.report.find((row) => row.id === report.id).status, 'PENDING');
    assert.equal(history(report.id).length, 0);
    assert.equal(actions(report.id).length, 0);
  });

  test('a supervisor cannot transition a foreign report through the citizen route', async () => {
    const report = h.makeReport(citizen, { status: 'PENDING' });

    const res = await h.api('PATCH', `/api/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'IN_PROGRESS' },
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.errorCode, 'REPORT_NOT_FOUND');
    assert.equal(h.db.tables.report.find((row) => row.id === report.id).status, 'PENDING');
    assert.equal(history(report.id).length, 0);
    assert.equal(actions(report.id).length, 0);
  });
});
