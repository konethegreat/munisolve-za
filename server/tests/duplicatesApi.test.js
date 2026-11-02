'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

const BODY = {
  title: 'Pothole on Main Road',
  description: 'A deep pothole has opened at the corner and is damaging cars.',
  category: 'POTHOLE',
  municipality: 'City of Johannesburg',
  latitude: -26.2041,
  longitude: 28.0473,
};

describe('duplicate reports', () => {
  let h;
  let alice;
  let bob;
  let admin;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => {
    h.reset();
    alice = h.makeUser({ email: 'alice@example.com', firstName: 'Alice' });
    bob = h.makeUser({ email: 'bob@example.com', firstName: 'Bob' });
    admin = h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
  });

  const as = (user) => h.tokenFor(user);
  const row = (id) => h.db.tables.report.find((report) => report.id === id);

  async function openReport(owner, overrides = {}) {
    return h.makeReport(owner, {
      title: 'Pothole on Main Road',
      category: 'POTHOLE',
      municipality: 'City of Johannesburg',
      latitude: -26.2041,
      longitude: 28.0473,
      ...overrides,
    });
  }

  async function create(token, overrides = {}) {
    return h.api('POST', '/api/reports', { token, body: { ...BODY, ...overrides } });
  }

  test('suggests an open report at the same place and returns it with the creation', async () => {
    const existing = await openReport(bob);

    const res = await create(as(alice));

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(res.body.data.mergedInto, null);
    assert.equal(res.body.data.duplicates.length, 1);
    assert.equal(res.body.data.duplicates[0].candidateId, existing.id);
    assert.equal(res.body.data.duplicates[0].status, 'SUGGESTED');
    assert.ok(res.body.data.duplicates[0].score >= 0.65);
    assert.equal(h.db.tables.duplicateCandidate.length, 1);
  });

  test('never suggests a duplicate when the new report has no coordinates', async () => {
    await openReport(bob);

    const res = await create(as(alice), { latitude: undefined, longitude: undefined });

    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data.duplicates, []);
    assert.equal(h.db.tables.duplicateCandidate.length, 0);
  });

  test('merges the same reporter\'s near-certain repeat immediately and keeps the original clock', async () => {
    const existing = await openReport(alice);
    const originalResolution = new Date(existing.resolutionDueAt ?? Date.now() + 86_400_000);
    h.db.tables.report.find((report) => report.id === existing.id).resolutionDueAt = originalResolution;

    const res = await create(as(alice));

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'CLOSED');
    assert.equal(res.body.data.closureReason, 'DUPLICATE');
    assert.equal(res.body.data.duplicateOfId, existing.id);
    assert.equal(res.body.data.responseDueAt, null);
    assert.equal(res.body.data.resolutionDueAt, null);
    assert.equal(res.body.data.mergedInto.id, existing.id);
    assert.equal(row(existing.id).resolutionDueAt.getTime(), originalResolution.getTime());

    assert.equal(h.db.tables.mergeRecord.length, 1);
    assert.equal(h.db.tables.mergeRecord[0].duplicateId, res.body.data.id);
    assert.equal(h.db.tables.mergeRecord[0].canonicalId, existing.id);
    assert.equal(h.db.tables.reportFollower.length, 1);
    assert.equal(h.db.tables.reportStatusHistory.filter((entry) => entry.toStatus === 'CLOSED').length, 1);
    assert.ok(h.db.tables.activityLog.some((log) => log.action === 'REPORT_MERGED'));
  });

  test('lists suggestions to the owner and admin only, and confirm clears the duplicate SLA', async () => {
    const existing = await openReport(bob);
    const created = await create(as(alice));
    const duplicateId = created.body.data.id;

    const owner = await h.api('GET', `/api/reports/${duplicateId}/duplicates`, { token: as(alice) });
    assert.equal(owner.status, 200);
    assert.equal(owner.body.data.length, 1);
    assert.equal(owner.body.data[0].candidate.id, existing.id);

    assert.equal((await h.api('GET', `/api/reports/${duplicateId}/duplicates`, { token: as(bob) })).status, 404);
    assert.equal((await h.api('GET', `/api/reports/${duplicateId}/duplicates`, { token: as(admin) })).status, 200);

    const confirmed = await h.api('POST', `/api/reports/${duplicateId}/duplicates/${existing.id}/confirm`, {
      token: as(alice),
    });

    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data.status, 'CLOSED');
    assert.equal(confirmed.body.data.duplicateOfId, existing.id);
    assert.equal(confirmed.body.data.resolutionDueAt, null);
    assert.equal(row(duplicateId).responseDueAt, null);
    assert.equal(h.db.tables.duplicateCandidate[0].status, 'MERGED');

    const again = await h.api('POST', `/api/reports/${duplicateId}/duplicates/${existing.id}/confirm`, {
      token: as(alice),
    });
    assert.equal(again.status, 409);
    assert.equal(again.body.errorCode, 'DUPLICATE_ALREADY_RESOLVED');
  });

  test('dismiss keeps both reports and records the decision', async () => {
    const existing = await openReport(bob);
    const created = await create(as(alice), { title: 'Broken road surface near the shops' });
    const duplicateId = created.body.data.id;

    const dismissed = await h.api('POST', `/api/reports/${duplicateId}/duplicates/${existing.id}/dismiss`, {
      token: as(alice),
    });

    assert.equal(dismissed.status, 200);
    assert.equal(dismissed.body.data.status, 'DISMISSED');
    assert.equal(row(duplicateId).status, 'PENDING');
    assert.equal(row(existing.id).status, 'PENDING');
    assert.ok(h.db.tables.activityLog.some((log) => log.action === 'DUPLICATE_DISMISSED'));
  });

  test('an admin can unmerge, restoring PENDING with fresh SLA windows', async () => {
    const existing = await openReport(bob);
    const created = await create(as(alice));
    const duplicateId = created.body.data.id;
    await h.api('POST', `/api/reports/${duplicateId}/duplicates/${existing.id}/confirm`, { token: as(alice) });

    const denied = await h.api('POST', `/api/admin/reports/${duplicateId}/unmerge`, { token: as(alice) });
    assert.equal(denied.status, 403);

    const res = await h.api('POST', `/api/admin/reports/${duplicateId}/unmerge`, { token: as(admin) });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(res.body.data.duplicateOfId, null);
    assert.equal(res.body.data.closureReason, null);
    assert.ok(res.body.data.responseDueAt);
    assert.ok(res.body.data.resolutionDueAt);
    assert.ok(res.body.data.slaCycleStartedAt);
    assert.ok(new Date(res.body.data.resolutionDueAt) > new Date());
    assert.ok(h.db.tables.mergeRecord[0].undoneAt);
    assert.ok(h.db.tables.activityLog.some((log) => log.action === 'REPORT_UNMERGED'));

    const again = await h.api('POST', `/api/admin/reports/${duplicateId}/unmerge`, { token: as(admin) });
    assert.equal(again.status, 409);
    assert.equal(again.body.errorCode, 'NOT_MERGED');
  });
});
