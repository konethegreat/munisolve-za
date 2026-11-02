'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('report SLA windows', () => {
  let h;
  let citizen;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => {
    h.reset();
    citizen = h.makeUser({ email: 'citizen@example.com' });
  });

  test('a new report receives the default windows when no policy row exists', async () => {
    const beforeRequest = Date.now();
    const res = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Pothole on the test road',
        description: 'A synthetic report used to check SLA windows.',
        category: 'POTHOLE',
        municipality: 'City of Johannesburg',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.responseDueAt);
    assert.ok(res.body.data.resolutionDueAt);
    assert.ok(res.body.data.slaCycleStartedAt);
    assert.ok(new Date(res.body.data.responseDueAt).getTime() >= beforeRequest + 72 * HOUR - 5000);
    assert.ok(new Date(res.body.data.resolutionDueAt).getTime() >= beforeRequest + 14 * DAY - 5000);
  });

  test('a configured policy row overrides the default', async () => {
    h.db.add('slaPolicy', { category: 'WATER_LEAK', responseMinutes: 60, resolutionMinutes: 240 });

    const beforeRequest = Date.now();
    const res = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Burst pipe on the test road',
        description: 'A synthetic water leak used to check the policy lookup.',
        category: 'WATER_LEAK',
        municipality: 'City of Tshwane',
      },
    });

    assert.equal(res.status, 201);
    const responseDue = new Date(res.body.data.responseDueAt).getTime();
    assert.ok(responseDue >= beforeRequest + HOUR - 5000);
    assert.ok(responseDue <= beforeRequest + HOUR + 5000);
  });

  test('an inactive policy falls back to the default', async () => {
    h.db.add('slaPolicy', { category: 'POTHOLE', responseMinutes: 1, resolutionMinutes: 1, isActive: false });

    const res = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Pothole on another test road',
        description: 'A synthetic report used to check the inactive policy fallback.',
        category: 'POTHOLE',
        municipality: 'City of Johannesburg',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(new Date(res.body.data.responseDueAt).getTime() > Date.now() + 71 * HOUR);
  });
});
