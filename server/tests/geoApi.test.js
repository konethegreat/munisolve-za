'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

describe('geo and docs endpoints', () => {
  let app;

  before(async () => {
    app = await startApp();
  });

  after(async () => {
    await app.close();
  });

  test('serves place search with OpenStreetMap attribution', async () => {
    const response = await app.api('GET', '/api/geo/search?q=Johannesburg&limit=2');

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.count, 1);
    assert.equal(response.body.data[0].displayName, 'Johannesburg, Johannesburg, South Africa');
    assert.equal(response.body.attribution, '© OpenStreetMap contributors, ODbL');
    assert.deepEqual(app.geo.searches, [['Johannesburg', { limit: 2 }]]);
  });

  test('reverse geocodes and validates coordinates', async () => {
    const ok = await app.api('GET', '/api/geo/reverse?lat=-26.2041&lon=28.0473');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.address.city, 'Johannesburg');
    assert.equal(ok.body.attribution, '© OpenStreetMap contributors, ODbL');

    const bad = await app.api('GET', '/api/geo/reverse?lat=200&lon=28.0473');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.errorCode, 'VALIDATION_ERROR');

    const short = await app.api('GET', '/api/geo/search?q=a');
    assert.equal(short.status, 400);
    assert.equal(short.body.errorCode, 'VALIDATION_ERROR');
  });

  test('publishes the OpenAPI document', async () => {
    const response = await app.api('GET', '/api/openapi.json');

    assert.equal(response.status, 200);
    assert.equal(response.body.openapi, '3.1.0');
    assert.equal(response.body.info.title, 'MuniSolve ZA API');
    assert.ok(response.body.paths['/api/geo/search']);
    assert.ok(response.body.paths['/api/admin/webhooks']);
    assert.ok(response.body.paths['/api/internal/tick']);
  });

  test('renders a dependency-free docs page', async () => {
    const response = await app.api('GET', '/api/docs');

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.text, /MuniSolve ZA API/);
    assert.match(response.text, /\/api\/geo\/search/);
    assert.doesNotMatch(response.text, /<script/i);
  });
});
