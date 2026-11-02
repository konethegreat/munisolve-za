'use strict';

const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

const TEN_MINUTES = 10 * 60 * 1000;

function decisionFor(h, reportId) {
  return h.db.tables.assignmentDecision.find((row) => row.reportId === reportId);
}

describe('automatic assignment through the tick', () => {
  let h;
  const savedFlag = process.env.AUTO_ASSIGN_ENABLED;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => h.reset());
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.AUTO_ASSIGN_ENABLED;
    else process.env.AUTO_ASSIGN_ENABLED = savedFlag;
  });

  test('assigns an eligible report once and notifies an admin', async () => {
    process.env.AUTO_ASSIGN_ENABLED = 'true';
    const owner = h.makeUser({ email: 'owner@example.com' });
    const admin = h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
    const team = h.makeTeam({
      name: 'Roads Crew',
      municipality: 'City of Johannesburg',
      latitude: 0,
      longitude: 0,
      autoAssignEnabled: true,
    });
    const report = h.makeReport(owner, {
      createdAt: new Date(Date.now() - TEN_MINUTES),
      latitude: 0,
      longitude: 0,
    });

    const first = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(first.status, 200);
    assert.equal(first.body.data.autoAssigned, 1);
    assert.equal(first.body.data.decisions, 1);

    const stored = h.db.tables.report.find((row) => row.id === report.id);
    assert.equal(stored.status, 'ASSIGNED');
    assert.equal(stored.assignedTeamId, team.id);

    const history = h.db.tables.reportStatusHistory.filter((row) => row.reportId === report.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].fromStatus, 'PENDING');
    assert.equal(history[0].toStatus, 'ASSIGNED');
    assert.equal(history[0].actorRole, 'SYSTEM');
    assert.match(history[0].note, /Auto-assigned by SYSTEM/);

    const activity = h.db.tables.activityLog.find((row) => row.entityId === report.id && row.action === 'REPORT_ASSIGNED');
    assert.ok(activity);
    assert.match(activity.description, /auto-assigned by SYSTEM/);

    const decision = decisionFor(h, report.id);
    assert.equal(decision.mode, 'AUTO');
    assert.equal(decision.teamId, team.id);
    assert.ok(decision.score >= 70);
    assert.ok(JSON.parse(decision.reasons).includes('skill_match'));

    const outbox = h.db.tables.notificationOutbox.filter((row) => row.reportId === report.id);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].dedupeKey, `autoassign:r${report.id}:t${team.id}`);
    assert.equal(outbox[0].kind, 'REPORT_AUTO_ASSIGNED');
    assert.equal(outbox[0].recipientEmail, admin.email);
    assert.equal(outbox[0].status, 'SENT');
    assert.ok(h.notifications.some((message) => message.to === admin.email));

    const second = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });
    assert.equal(second.status, 200);
    assert.equal(second.body.data.autoAssigned, 0);
    assert.equal(second.body.data.decisions, 0);
    assert.equal(h.db.tables.assignmentDecision.filter((row) => row.reportId === report.id).length, 1);
    assert.equal(h.db.tables.notificationOutbox.filter((row) => row.reportId === report.id).length, 1);
  });

  test('records a SKIPPED decision for a report without coordinates', async () => {
    process.env.AUTO_ASSIGN_ENABLED = 'true';
    const owner = h.makeUser();
    h.makeTeam({ municipality: 'City of Johannesburg', latitude: 0, longitude: 0, autoAssignEnabled: true });
    const report = h.makeReport(owner, { createdAt: new Date(Date.now() - TEN_MINUTES) });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.autoAssigned, 0);
    assert.equal(res.body.data.decisions, 1);
    const decision = decisionFor(h, report.id);
    assert.equal(decision.mode, 'SKIPPED');
    assert.ok(JSON.parse(decision.reasons).includes('NO_COORDINATES'));
    assert.equal(h.db.tables.report.find((row) => row.id === report.id).status, 'PENDING');
  });

  test('records a SKIPPED decision when the only team has not opted in', async () => {
    process.env.AUTO_ASSIGN_ENABLED = 'true';
    const owner = h.makeUser();
    h.makeTeam({ municipality: 'City of Johannesburg', latitude: 0, longitude: 0 });
    const report = h.makeReport(owner, {
      createdAt: new Date(Date.now() - TEN_MINUTES),
      latitude: 0,
      longitude: 0,
    });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.body.data.autoAssigned, 0);
    assert.equal(res.body.data.decisions, 1);
    assert.ok(JSON.parse(decisionFor(h, report.id).reasons).includes('TEAM_AUTO_ASSIGN_DISABLED'));
  });

  test('never assigns a report that still has a suggested duplicate', async () => {
    process.env.AUTO_ASSIGN_ENABLED = 'true';
    const owner = h.makeUser();
    h.makeTeam({ municipality: 'City of Johannesburg', latitude: 0, longitude: 0, autoAssignEnabled: true });
    const original = h.makeReport(owner, { createdAt: new Date(), latitude: 0, longitude: 0 });
    const report = h.makeReport(owner, {
      title: 'Another pothole on the same corner',
      createdAt: new Date(Date.now() - TEN_MINUTES),
      latitude: 0,
      longitude: 0,
    });
    h.db.add('duplicateCandidate', { reportId: report.id, candidateId: original.id, score: 0.8 });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.body.data.decisions, 1);
    assert.equal(res.body.data.autoAssigned, 0);
    const decision = decisionFor(h, report.id);
    assert.equal(decision.mode, 'SKIPPED');
    assert.ok(JSON.parse(decision.reasons).includes('SUGGESTED_DUPLICATE'));
    assert.equal(h.db.tables.report.find((row) => row.id === report.id).status, 'PENDING');
  });

  test('does nothing while AUTO_ASSIGN_ENABLED is off', async () => {
    process.env.AUTO_ASSIGN_ENABLED = 'false';
    const owner = h.makeUser();
    h.makeTeam({ municipality: 'City of Johannesburg', latitude: 0, longitude: 0, autoAssignEnabled: true });
    const report = h.makeReport(owner, {
      createdAt: new Date(Date.now() - TEN_MINUTES),
      latitude: 0,
      longitude: 0,
    });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.autoAssigned, 0);
    assert.equal(res.body.data.decisions, 0);
    assert.equal(h.db.tables.assignmentDecision.length, 0);
    assert.equal(h.db.tables.report.find((row) => row.id === report.id).status, 'PENDING');
  });
});
