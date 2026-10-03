'use strict';

// The reporting workflow across roles, end to end through the real routes:
// a citizen reports a fault, a supervisor triages and assigns it, work starts and finishes,
// an admin closes it, and the citizen sees each step. Another citizen never sees any of it.

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('report lifecycle', () => {
  let h;
  let alice;
  let bob;
  let supervisor;
  let admin;
  let roadsCrew;
  let waterCrew;

  before(async () => {
    h = await startApp();
  });
  after(() => h.close());
  beforeEach(() => {
    h.reset();
    alice = h.makeUser({ email: 'alice@example.com', firstName: 'Alice' });
    bob = h.makeUser({ email: 'bob@example.com', firstName: 'Bob' });
    supervisor = h.makeUser({ email: 'supervisor@example.com', role: 'WORKER_SUPERVISOR' });
    admin = h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
    roadsCrew = h.makeTeam({ name: 'Roads Crew', specialization: 'Roads & Infrastructure' });
    waterCrew = h.makeTeam({ name: 'Water Crew', specialization: 'Water & Sanitation' });
  });

  const as = (user) => h.tokenFor(user);
  const statusSeenBy = async (user, reportId) => {
    const res = await h.api('GET', `/api/reports/${reportId}`, { token: as(user) });
    return res.status === 200 ? res.body.data : null;
  };

  async function createPothole() {
    const res = await h.api('POST', '/api/reports', {
      token: as(alice),
      body: {
        title: 'Pothole on Sample Road',
        description: 'Synthetic report for the lifecycle test.',
        category: 'POTHOLE',
        municipality: 'City of Johannesburg',
      },
    });
    assert.equal(res.status, 201);
    return res.body.data;
  }

  test('a report moves from the citizen to the supervisor to resolution, and the citizen sees each step', async () => {
    // 1. The citizen files a report and can see it, pending.
    const report = await createPothole();
    assert.equal((await statusSeenBy(alice, report.id)).status, 'PENDING');

    // 2. A different citizen can neither see it nor find it in their own list.
    assert.equal(await statusSeenBy(bob, report.id), null);
    assert.equal((await h.api('GET', '/api/reports', { token: as(bob) })).body.count, 0);

    // 3. The supervisor finds it in the triage queue, with team suggestions ranked by fit.
    const triage = await h.api('GET', '/api/supervisor/reports/triage', { token: as(supervisor) });
    assert.deepEqual(triage.body.data.map((r) => r.id), [report.id]);
    const suggestions = await h.api('GET', `/api/supervisor/reports/${report.id}/suggestions`, { token: as(supervisor) });
    assert.equal(suggestions.body.data[0].name, 'Roads Crew');
    assert.equal(suggestions.body.data[0].specScore, 2);

    // 4. Assigning moves it to ASSIGNED and out of triage; the citizen sees the assignment.
    const assigned = await h.api('PATCH', `/api/supervisor/reports/${report.id}/assign`, {
      token: as(supervisor),
      body: { teamId: roadsCrew.id, note: 'Closest crew' },
    });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.body.data.status, 'ASSIGNED');
    assert.equal(assigned.body.data.team.name, 'Roads Crew');
    const seenAssigned = await statusSeenBy(alice, report.id);
    assert.equal(seenAssigned.status, 'ASSIGNED');
    assert.equal(seenAssigned.assignedTeamId, roadsCrew.id);
    assert.ok(seenAssigned.assignedAt);
    assert.equal((await h.api('GET', '/api/supervisor/reports/triage', { token: as(supervisor) })).body.count, 0);
    const active = await h.api('GET', '/api/supervisor/reports/active', { token: as(supervisor) });
    assert.deepEqual(active.body.data.map((r) => r.id), [report.id]);

    // 5. Work starts.
    const started = await h.api('PATCH', `/api/supervisor/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'IN_PROGRESS' },
    });
    assert.equal(started.status, 200);
    assert.equal((await statusSeenBy(alice, report.id)).status, 'IN_PROGRESS');

    // 6. Resolving needs an after-photo URL.
    const noPhoto = await h.api('PATCH', `/api/supervisor/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'RESOLVED' },
    });
    assert.equal(noPhoto.status, 400);
    assert.equal(noPhoto.body.errorCode, 'AFTER_PHOTO_REQUIRED');
    assert.equal((await statusSeenBy(alice, report.id)).status, 'IN_PROGRESS');

    const resolved = await h.api('PATCH', `/api/supervisor/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'RESOLVED', afterPhotoUrl: 'https://example.com/after.jpg', note: 'Patched' },
    });
    assert.equal(resolved.status, 200);
    const seenResolved = await statusSeenBy(alice, report.id);
    assert.equal(seenResolved.status, 'RESOLVED');
    assert.equal(seenResolved.afterPhotoUrl, 'https://example.com/after.jpg');

    // 7. An admin closes it and the citizen sees that too.
    const closed = await h.api('PATCH', `/api/admin/reports/${report.id}/status`, {
      token: as(admin),
      body: { status: 'CLOSED' },
    });
    assert.equal(closed.status, 200);
    assert.equal((await statusSeenBy(alice, report.id)).status, 'CLOSED');

    // 8. Bob still sees nothing, and the audit trail records every step in order.
    assert.equal(await statusSeenBy(bob, report.id), null);
    const trail = h.db.tables.activityLog
      .filter((log) => log.entity === 'Report' && log.entityId === report.id)
      .map((log) => log.action);
    assert.deepEqual(trail, [
      'CREATE_REPORT',
      'REPORT_ASSIGNED',
      'REPORT_STATUS_CHANGED',
      'REPORT_STATUS_CHANGED',
      'ADMIN_UPDATE_REPORT_STATUS',
    ]);
  });

  test('the admin dashboard and activity log reflect the work done', async () => {
    const report = await createPothole();
    await h.api('PATCH', `/api/reports/${report.id}/status`, { token: as(alice), body: { status: 'RESOLVED' } });
    await createPothole();

    const dashboard = await h.api('GET', '/api/admin/dashboard', { token: as(admin) });
    const { reports, users } = dashboard.body.data;
    assert.equal(reports.total, 2);
    assert.equal(reports.pending, 1);
    assert.equal(reports.resolved, 1);
    assert.equal(reports.resolutionRate, 50);
    assert.equal(users.total, 4);

    const logs = await h.api('GET', '/api/admin/activity-logs?action=status', { token: as(admin) });
    assert.equal(logs.body.total, 1);
    assert.equal(logs.body.data[0].action, 'UPDATE_STATUS');
    assert.equal(logs.body.data[0].user.email, 'alice@example.com');
  });

  describe('assigning a report', () => {
    test('needs a team that exists and is active', async () => {
      const report = h.makeReport(alice);
      const assign = (body) =>
        h.api('PATCH', `/api/supervisor/reports/${report.id}/assign`, { token: as(supervisor), body });
      const idle = h.makeTeam({ name: 'Idle Crew', specialization: 'Waste', isActive: false });

      assert.equal((await assign({})).status, 400);
      assert.equal((await assign({ teamId: 9999 })).status, 404);
      const inactive = await assign({ teamId: idle.id });
      assert.equal(inactive.status, 400);
      assert.equal(inactive.body.message, 'Cannot assign to an inactive team.');
      assert.equal(h.db.tables.report[0].status, 'PENDING');
    });

    test('is only possible while the report is PENDING or ASSIGNED, and can be redone', async () => {
      const assigned = h.makeReport(alice, { status: 'PENDING' });
      const first = await h.api('PATCH', `/api/supervisor/reports/${assigned.id}/assign`, {
        token: as(supervisor),
        body: { teamId: roadsCrew.id },
      });
      const again = await h.api('PATCH', `/api/supervisor/reports/${assigned.id}/assign`, {
        token: as(supervisor),
        body: { teamId: waterCrew.id },
      });
      assert.equal(first.status, 200);
      assert.equal(again.status, 200);
      assert.equal(again.body.data.team.name, 'Water Crew');

      for (const status of ['IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED']) {
        const report = h.makeReport(alice, { status });
        const res = await h.api('PATCH', `/api/supervisor/reports/${report.id}/assign`, {
          token: as(supervisor),
          body: { teamId: roadsCrew.id },
        });
        assert.equal(res.status, 400, status);
        assert.equal(res.body.message, `Cannot assign a report with status ${status}.`);
      }
    });
  });

  test('a supervisor can set ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED or REJECTED, but not PENDING', async () => {
    const report = h.makeReport(alice, { status: 'IN_PROGRESS' });

    const res = await h.api('PATCH', `/api/supervisor/reports/${report.id}/status`, {
      token: as(supervisor),
      body: { status: 'PENDING' },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Must be one of: ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, REJECTED/);
    assert.equal(h.db.tables.report[0].status, 'IN_PROGRESS');
  });

  test('a supervisor gets 404 for a report that does not exist', async () => {
    const res = await h.api('PATCH', '/api/supervisor/reports/9999/status', {
      token: as(supervisor),
      body: { status: 'IN_PROGRESS' },
    });

    assert.equal(res.status, 404);
  });
});
