'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('reports', () => {
  let h;
  let alice;
  let bob;
  let admin;

  before(async () => {
    h = await startApp();
  });
  after(() => h.close());
  beforeEach(() => {
    h.reset();
    alice = h.makeUser({ email: 'alice@example.com', firstName: 'Alice', lastName: 'Citizen' });
    bob = h.makeUser({ email: 'bob@example.com', firstName: 'Bob', lastName: 'Citizen' });
    admin = h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
  });

  const as = (user) => h.tokenFor(user);
  const reportRow = (id) => h.db.tables.report.find((row) => row.id === id);
  const logsFor = (action) => h.db.tables.activityLog.filter((log) => log.action === action);

  describe('creating', () => {
    const body = {
      title: 'Pothole on Sample Road',
      description: 'Deep pothole near the corner.',
      category: 'POTHOLE',
      municipality: 'City of Johannesburg',
      address: 'Sample Road (made up)',
    };

    test('creates a PENDING report owned by the caller, ignoring ownership and status in the body', async () => {
      const res = await h.api('POST', '/api/reports', {
        token: as(alice),
        body: { ...body, userId: bob.id, status: 'RESOLVED', assignedTeamId: 1, afterPhotoUrl: 'https://example.com/x.jpg' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, 'PENDING');
      assert.equal(res.body.data.userId, alice.id);
      assert.equal(res.body.data.assignedTeamId, null);
      assert.equal(res.body.data.afterPhotoUrl, null);
      assert.ok(!('password' in res.body.data.user));
      assert.equal(reportRow(res.body.data.id).userId, alice.id);
      assert.equal(logsFor('CREATE_REPORT').length, 1);
    });

    test('adds the assistant acknowledgement, and a fallback message when the AI is down', async () => {
      const ok = await h.api('POST', '/api/reports', { token: as(alice), body });
      assert.equal(ok.body.data.aiResponse, 'Stubbed assistant reply.');

      h.anthropic.fail = true;
      const fallback = await h.api('POST', '/api/reports', { token: as(alice), body });
      assert.equal(fallback.status, 201);
      assert.match(fallback.body.data.aiResponse, /^Hi Alice! Your report has been received/);
      assert.ok(fallback.body.data.aiResponse.includes(`#${String(fallback.body.data.id).padStart(4, '0')}`));
    });

    test('looks up weather only when coordinates are sent, and stores the result', async () => {
      await h.api('POST', '/api/reports', { token: as(alice), body });
      assert.equal(h.weather.calls.length, 0);

      h.weather.result = {
        weatherTemp: 21,
        weatherCondition: 'Sunny',
        weatherRainfall: 0,
        weatherWind: 12,
        weatherHumidity: 40,
      };
      const res = await h.api('POST', '/api/reports', {
        token: as(alice),
        body: { ...body, latitude: '-26.2041', longitude: '28.0473' },
      });

      assert.equal(res.status, 201);
      assert.deepEqual(h.weather.calls, [[-26.2041, 28.0473]]);
      assert.equal(res.body.data.latitude, -26.2041);
      assert.equal(res.body.data.weatherCondition, 'Sunny');
    });

    test('requires a token', async () => {
      const res = await h.api('POST', '/api/reports', { body });

      assert.equal(res.status, 401);
      assert.equal(h.db.tables.report.length, 0);
    });
  });

  describe('reading', () => {
    test('a citizen lists only their own reports, newest first', async () => {
      const first = h.makeReport(alice, { title: 'First' });
      const second = h.makeReport(alice, { title: 'Second' });
      h.makeReport(bob, { title: 'Bobs report' });

      const res = await h.api('GET', '/api/reports', { token: as(alice) });

      assert.equal(res.status, 200);
      assert.equal(res.body.count, 2);
      assert.deepEqual(
        res.body.data.map((r) => r.id),
        [second.id, first.id]
      );
      assert.ok(res.body.data.every((r) => r.userId === alice.id));
    });

    test('filters by status, category and municipality', async () => {
      const match = h.makeReport(alice, { status: 'IN_PROGRESS', category: 'WATER_LEAK', municipality: 'City of Tshwane' });
      h.makeReport(alice, { status: 'PENDING', category: 'WATER_LEAK', municipality: 'City of Tshwane' });
      h.makeReport(alice, { status: 'IN_PROGRESS', category: 'POTHOLE', municipality: 'City of Tshwane' });
      h.makeReport(alice, { status: 'IN_PROGRESS', category: 'WATER_LEAK', municipality: 'City of Cape Town' });

      const res = await h.api(
        'GET',
        '/api/reports?status=IN_PROGRESS&category=WATER_LEAK&municipality=' + encodeURIComponent('City of Tshwane'),
        { token: as(alice) }
      );

      assert.deepEqual(
        res.body.data.map((r) => r.id),
        [match.id]
      );
    });

    test('an admin lists every citizen report', async () => {
      h.makeReport(alice);
      h.makeReport(bob);

      const res = await h.api('GET', '/api/reports', { token: as(admin) });

      assert.equal(res.body.count, 2);
    });

    test('the owner and an admin can open a report', async () => {
      const report = h.makeReport(alice);

      const owner = await h.api('GET', `/api/reports/${report.id}`, { token: as(alice) });
      const staff = await h.api('GET', `/api/reports/${report.id}`, { token: as(admin) });

      assert.equal(owner.status, 200);
      assert.equal(owner.body.data.id, report.id);
      assert.equal(staff.status, 200);
    });

    test("another citizen gets a 404 for it, the same answer as for a report that does not exist", async () => {
      const report = h.makeReport(alice);

      const other = await h.api('GET', `/api/reports/${report.id}`, { token: as(bob) });
      const missing = await h.api('GET', '/api/reports/99999', { token: as(bob) });

      assert.equal(other.status, 404);
      assert.deepEqual(other.body, missing.body);
    });
  });

  describe('editing and deleting', () => {
    test('the owner can edit the text but not the status or the owner', async () => {
      const report = h.makeReport(alice);

      const res = await h.api('PUT', `/api/reports/${report.id}`, {
        token: as(alice),
        body: { title: 'Updated title', description: 'Updated description', status: 'RESOLVED', userId: bob.id },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.title, 'Updated title');
      const stored = reportRow(report.id);
      assert.equal(stored.description, 'Updated description');
      assert.equal(stored.status, 'PENDING');
      assert.equal(stored.userId, alice.id);
    });

    test("another citizen can neither edit nor delete it", async () => {
      const report = h.makeReport(alice);
      const untouched = h.db.snapshot();

      const edit = await h.api('PUT', `/api/reports/${report.id}`, { token: as(bob), body: { title: 'Defaced' } });
      const remove = await h.api('DELETE', `/api/reports/${report.id}`, { token: as(bob) });

      assert.equal(edit.status, 404);
      assert.equal(remove.status, 404);
      assert.deepEqual(h.db.snapshot(), untouched);
    });

    test('the owner can delete their report', async () => {
      const report = h.makeReport(alice);

      const res = await h.api('DELETE', `/api/reports/${report.id}`, { token: as(alice) });

      assert.equal(res.status, 200);
      assert.equal(reportRow(report.id), undefined);
    });
  });

  describe('changing the status', () => {
    test('a citizen can confirm their own PENDING or IN_PROGRESS report as RESOLVED, and it is logged', async () => {
      const pending = h.makeReport(alice, { status: 'PENDING' });
      const inProgress = h.makeReport(alice, { status: 'IN_PROGRESS' });

      for (const report of [pending, inProgress]) {
        const res = await h.api('PATCH', `/api/reports/${report.id}/status`, {
          token: as(alice),
          body: { status: 'RESOLVED', note: 'Fixed, thanks' },
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.data.status, 'RESOLVED');
        assert.equal(reportRow(report.id).status, 'RESOLVED');
      }

      const descriptions = logsFor('UPDATE_STATUS').map((log) => log.description);
      assert.deepEqual(descriptions, [
        'Status changed from PENDING → RESOLVED: Fixed, thanks',
        'Status changed from IN_PROGRESS → RESOLVED: Fixed, thanks',
      ]);
    });

    test('a citizen cannot set any status except RESOLVED', async () => {
      const report = h.makeReport(alice, { status: 'PENDING' });

      for (const status of ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REJECTED', 'CLOSED']) {
        const res = await h.api('PATCH', `/api/reports/${report.id}/status`, { token: as(alice), body: { status } });
        assert.equal(res.status, 403, status);
        assert.equal(res.body.errorCode, 'INSUFFICIENT_PERMISSIONS', status);
      }
      assert.equal(reportRow(report.id).status, 'PENDING');
    });

    test('a citizen cannot resolve a report that is assigned, closed, rejected or already resolved', async () => {
      for (const status of ['ASSIGNED', 'CLOSED', 'REJECTED', 'RESOLVED']) {
        const report = h.makeReport(alice, { status });

        const res = await h.api('PATCH', `/api/reports/${report.id}/status`, { token: as(alice), body: { status: 'RESOLVED' } });

        assert.equal(res.status, 400, status);
        assert.equal(res.body.message, `Cannot change status from ${status} to RESOLVED.`);
        assert.equal(reportRow(report.id).status, status);
      }
    });

    test("a citizen cannot change another citizen's report", async () => {
      const report = h.makeReport(alice);

      const res = await h.api('PATCH', `/api/reports/${report.id}/status`, { token: as(bob), body: { status: 'RESOLVED' } });

      assert.equal(res.status, 404);
      assert.equal(reportRow(report.id).status, 'PENDING');
    });

    test('rejects a status that does not exist', async () => {
      const report = h.makeReport(alice);

      const res = await h.api('PATCH', `/api/reports/${report.id}/status`, { token: as(admin), body: { status: 'DONE' } });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /Must be one of: PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED, CLOSED/);
    });

    test('an admin can set any status, from either admin endpoint, and the owner sees it', async () => {
      const report = h.makeReport(alice);

      const viaReports = await h.api('PATCH', `/api/reports/${report.id}/status`, {
        token: as(admin),
        body: { status: 'IN_PROGRESS' },
      });
      assert.equal(viaReports.status, 200);
      assert.equal((await h.api('GET', `/api/reports/${report.id}`, { token: as(alice) })).body.data.status, 'IN_PROGRESS');

      const viaAdmin = await h.api('PATCH', `/api/admin/reports/${report.id}/status`, {
        token: as(admin),
        body: { status: 'REJECTED' },
      });
      assert.equal(viaAdmin.status, 200);
      assert.equal((await h.api('GET', `/api/reports/${report.id}`, { token: as(alice) })).body.data.status, 'REJECTED');

      assert.equal(logsFor('UPDATE_STATUS').length, 1);
      assert.equal(logsFor('ADMIN_UPDATE_REPORT_STATUS').length, 1);
    });
  });
});
