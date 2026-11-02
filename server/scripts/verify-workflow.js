'use strict';

// Real HTTP handlers + Prisma + PostgreSQL. No signed-token or database stubs.
const assert = require('node:assert/strict');

async function verifyWorkflow(baseURL, password, tickSecret) {
  const target = new URL(baseURL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Workflow verification is local only.');
  const steps = [];
  async function request(label, method, route, status, token, body, extraHeaders = {}) {
    const response = await fetch(baseURL + route, {
      method, signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...extraHeaders },
      ...(body && { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, status, `${label}: ${method} ${route}`);
    const json = await response.json();
    steps.push({ label, status });
    return json;
  }
  const tokens = {};
  for (const [role, email] of Object.entries({
    citizenA: 'demo.citizen.a@example.com', citizenB: 'demo.citizen.b@example.com',
    supervisor: 'demo.supervisor@example.com', admin: 'demo.admin@example.com',
  })) {
    const login = await request(`${role} logs in`, 'POST', '/auth/login', 200, null, { email, password });
    assert.equal(typeof login.data.token, 'string');
    assert.ok(!('password' in login.data.user), 'Passwords stay out of login responses.');
    tokens[role] = login.data.token;
  }
  await request('Wrong password is rejected', 'POST', '/auth/login', 401, null,
    { email: 'demo.citizen.a@example.com', password: `${password}-wrong` });
  await request('Anonymous report access is denied', 'GET', '/reports', 401);
  await request('Citizen cannot read admin dashboard', 'GET', '/admin/dashboard', 403, tokens.citizenA);
  await request('Citizen cannot read triage queue', 'GET', '/supervisor/reports/triage', 403, tokens.citizenA);
  await request('Supervisor cannot read admin dashboard', 'GET', '/admin/dashboard', 403, tokens.supervisor);

  const created = await request('Citizen submits a fictional pothole', 'POST', '/reports', 201, tokens.citizenA, {
    title: 'Demo workflow: pothole on Fictional Lane',
    description: 'Synthetic walkthrough only. A fictional pothole for testing the reporting workflow.',
    category: 'POTHOLE', municipality: 'City of Johannesburg', address: 'Fictional Lane (synthetic)',
    latitude: -26.21, longitude: 28.05,
  });
  const report = created.data;
  assert.equal(report.status, 'PENDING');
  assert.equal(report.aiResponse, null, 'Report creation works without an AI credential.');
  assert.equal(report.weatherTemp, null, 'Weather is disabled in the demo environment.');
  const route = `/reports/${report.id}`;
  async function citizenSees(status) {
    const seen = await request(`Citizen sees ${status}`, 'GET', route, 200, tokens.citizenA);
    assert.equal(seen.data.status, status);
    return seen.data;
  }
  await citizenSees('PENDING');
  const other = await request('Other citizen sees only their own reports', 'GET', '/reports', 200, tokens.citizenB);
  assert.equal(other.data.length, 2);
  assert.ok(other.data.every((r) => r.user.email === 'demo.citizen.b@example.com'));
  await request('Other citizen cannot open this report', 'GET', route, 404, tokens.citizenB);
  await request('Other citizen cannot edit this report', 'PUT', route, 404, tokens.citizenB, { title: 'Attempted edit' });
  await request('Other citizen cannot delete this report', 'DELETE', route, 404, tokens.citizenB);
  await request('Citizen cannot start municipal work', 'PATCH', `${route}/status`, 403, tokens.citizenA, { status: 'IN_PROGRESS' });
  await request('Unconfigured AI is explicitly unavailable', 'POST', '/ai/chat', 503, tokens.citizenA,
    { reportId: report.id, message: 'What happens next?' });
  await request('AI endpoint also hides another citizen report', 'POST', '/ai/chat', 404, tokens.citizenB,
    { reportId: report.id, message: 'Show the other report.' });

  const triage = await request('Supervisor sees the submitted report in triage', 'GET', '/supervisor/reports/triage', 200, tokens.supervisor);
  assert.ok(triage.data.some((r) => r.id === report.id));
  const suggestions = await request('Roads crew is suggested first', 'GET', `/supervisor${route}/suggestions`, 200, tokens.supervisor);
  assert.equal(suggestions.data[0].name, 'Demo Roads Crew');
  const teamId = suggestions.data[0].id;
  await request('Citizen cannot assign a crew', 'PATCH', `/supervisor${route}/assign`, 403, tokens.citizenA, { teamId });
  await request('Supervisor assigns the roads crew', 'PATCH', `/supervisor${route}/assign`, 200, tokens.supervisor, { teamId });
  const assigned = await citizenSees('ASSIGNED');
  assert.equal(assigned.assignedTeamId, teamId);
  assert.ok(assigned.assignedAt);
  await request('Supervisor starts work', 'PATCH', `/supervisor${route}/status`, 200, tokens.supervisor, { status: 'IN_PROGRESS' });
  await citizenSees('IN_PROGRESS');
  const noPhoto = await request('Resolution without photo URL is rejected', 'PATCH', `/supervisor${route}/status`, 400, tokens.supervisor, { status: 'RESOLVED' });
  assert.equal(noPhoto.errorCode, 'AFTER_PHOTO_REQUIRED');
  await citizenSees('IN_PROGRESS');
  const photo = 'https://example.invalid/synthetic-after.jpg';
  await request('Supervisor resolves with a synthetic photo URL', 'PATCH', `/supervisor${route}/status`, 200, tokens.supervisor,
    { status: 'RESOLVED', afterPhotoUrl: photo });
  assert.equal((await citizenSees('RESOLVED')).afterPhotoUrl, photo);
  await request('Admin closes the report', 'PATCH', `/admin${route}/status`, 200, tokens.admin, { status: 'CLOSED' });
  await citizenSees('CLOSED');
  await request('Other citizen still cannot open the closed report', 'GET', route, 404, tokens.citizenB);
  const logs = await request('Admin reads the audit trail', 'GET', '/admin/activity-logs?entity=Report&limit=100', 200, tokens.admin);
  const actions = logs.data.filter((log) => log.entityId === report.id).sort((a, b) => a.id - b.id).map((log) => log.action);
  assert.deepEqual(actions, ['CREATE_REPORT', 'REPORT_ASSIGNED', 'REPORT_STATUS_CHANGED', 'REPORT_STATUS_CHANGED', 'ADMIN_UPDATE_REPORT_STATUS']);
  const dashboard = await request('Admin dashboard reflects five fictional reports', 'GET', '/admin/dashboard', 200, tokens.admin);
  assert.equal(dashboard.data.reports.total, 5);
  assert.equal(dashboard.data.users.total, 4);
  await request('Tick rejects an anonymous call', 'POST', '/internal/tick', 401);
  const tick = await request('Tick runs with the scheduler secret', 'POST', '/internal/tick', 200, null, undefined, {
    'x-tick-secret': tickSecret,
  });
  assert.equal(tick.data.enqueued, 0);
  assert.equal(tick.data.sent, 0);
  assert.equal(tick.data.autoAssigned, 0);
  assert.equal(tick.data.decisions, 0);

  const hook = await request('Admin registers a synthetic webhook receiver', 'POST', '/admin/webhooks', 201, tokens.admin, {
    url: 'https://example.invalid/munisolve-demo-hook',
    events: ['report.status_changed'],
    description: 'Synthetic receiver used by the disposable demo.',
  });
  assert.match(hook.data.secret, /^whsec_[0-9a-f]{48}$/, 'The secret is shown once, on creation.');
  const hooks = await request('Admin lists webhooks without their secrets', 'GET', '/admin/webhooks', 200, tokens.admin);
  assert.ok(hooks.data.some((entry) => entry.id === hook.data.id));
  assert.ok(hooks.data.every((entry) => !('secret' in entry)));
  const rotated = await request('Admin rotates the webhook secret', 'POST',
    `/admin/webhooks/${hook.data.id}/rotate-secret`, 200, tokens.admin);
  assert.notEqual(rotated.data.secret, hook.data.secret);
  const deliveries = await request('The new webhook has no deliveries yet', 'GET',
    `/admin/webhooks/${hook.data.id}/deliveries`, 200, tokens.admin);
  assert.equal(deliveries.data.length, 0);
  await request('Admin deletes the webhook', 'DELETE', `/admin/webhooks/${hook.data.id}`, 200, tokens.admin);

  const canonical = await request('Citizen A files a fictional report for duplicate checks', 'POST', '/reports', 201, tokens.citizenA, {
    title: 'Demo duplicates: broken paving on Synthetic Street',
    description: 'Synthetic walkthrough only. Broken paving used for the duplicate workflow.',
    category: 'POTHOLE', municipality: 'City of Johannesburg', address: 'Synthetic Street (made-up)',
    latitude: -26.2101, longitude: 28.0501,
  });
  const repeat = await request('Citizen B files the same fictional problem nearby', 'POST', '/reports', 201, tokens.citizenB, {
    title: 'Demo duplicates: broken paving on Synthetic Street',
    description: 'Synthetic walkthrough only. The same broken paving reported by a second citizen.',
    category: 'POTHOLE', municipality: 'City of Johannesburg', address: 'Synthetic Street (made-up)',
    latitude: -26.2102, longitude: 28.0502,
  });
  const duplicateSuggestions = await request('Duplicate suggestions are returned on creation', 'GET',
    `/reports/${repeat.data.id}/duplicates`, 200, tokens.citizenB);
  assert.ok(duplicateSuggestions.data.some((entry) => entry.candidate.id === canonical.data.id),
    'The nearby report is suggested as a duplicate.');
  await request('Citizen B cannot confirm a duplicate against another citizen report', 'POST',
    `/reports/${canonical.data.id}/duplicates/${repeat.data.id}/confirm`, 404, tokens.citizenB);
  await request('Citizen B confirms the duplicate', 'POST',
    `/reports/${repeat.data.id}/duplicates/${canonical.data.id}/confirm`, 200, tokens.citizenB);
  const merged = await request('The merged report is closed as a duplicate', 'GET', `/reports/${repeat.data.id}`, 200, tokens.citizenB);
  assert.equal(merged.data.status, 'CLOSED');
  assert.equal(merged.data.closureReason, 'DUPLICATE');
  assert.equal(merged.data.duplicateOfId, canonical.data.id);
  await request('Admin undoes the duplicate merge', 'POST', `/admin/reports/${repeat.data.id}/unmerge`, 200, tokens.admin);
  const restored = await request('The restored report is pending again', 'GET', `/reports/${repeat.data.id}`, 200, tokens.citizenB);
  assert.equal(restored.data.status, 'PENDING');
  assert.equal(restored.data.duplicateOfId, null);
  console.log(JSON.stringify({ result: 'passed', database: 'disposable PostgreSQL 16', steps,
    lifecycle: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    duplicateLifecycle: ['SUGGESTED', 'MERGED', 'CLOSED', 'UNMERGED', 'PENDING'],
    webhookLifecycle: ['CREATED', 'ROTATED', 'DELETED'],
    limitations: ['No real municipal submission', 'No AI, email, Google OAuth, weather, geocoding or webhook receiver verification',
      'Auto-assignment only runs for reports older than five minutes, so the tick has nothing to assign here',
      'Photo is a placeholder URL; no upload or repair verification', 'HTTP workflow; browser walkthrough is separate'],
  }, null, 2));
  return steps;
}

module.exports = { verifyWorkflow };
