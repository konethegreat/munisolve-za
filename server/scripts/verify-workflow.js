'use strict';

// Real HTTP handlers + Prisma + PostgreSQL. No signed-token or database stubs.
const assert = require('node:assert/strict');

async function verifyWorkflow(baseURL, password) {
  const target = new URL(baseURL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Workflow verification is local only.');
  const steps = [];
  async function request(label, method, route, status, token, body) {
    const response = await fetch(baseURL + route, {
      method, signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
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
    latitude: -26.2051, longitude: 28.0483,
  });
  const report = created.data;
  assert.equal(report.status, 'PENDING');
  assert.equal(report.aiResponse, null, 'Report creation works without an AI credential.');
  assert.equal(report.weatherTemp, null, 'Weather is absent without a credential.');
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
  console.log(JSON.stringify({ result: 'passed', database: 'disposable PostgreSQL 16', steps,
    lifecycle: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    limitations: ['No real municipal submission', 'No AI, email, Google OAuth or weather provider verification',
      'Photo is a placeholder URL; no upload or repair verification', 'HTTP workflow; browser walkthrough is separate'],
  }, null, 2));
  return steps;
}

module.exports = { verifyWorkflow };
