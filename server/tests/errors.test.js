'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');
const { mapPrismaError } = require('../src/errors/prismaErrors');
const { errorHandler } = require('../src/middleware/error.middleware');

describe('error contract', () => {
  let h;
  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => h.reset());

  test('an unknown route returns a JSON 404 with a request ID', async () => {
    const res = await h.api('GET', '/api/not-a-route');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorCode, 'NOT_FOUND');
    assert.match(res.body.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(res.headers.get('x-request-id'), res.body.requestId);
  });

  test('a valid inbound X-Request-Id is echoed and invalid values are replaced', async () => {
    const echoed = await h.api('GET', '/health', { headers: { 'x-request-id': 'trace-12345678' } });
    assert.equal(echoed.headers.get('x-request-id'), 'trace-12345678');

    const replaced = await h.api('GET', '/health', { headers: { 'x-request-id': 'bad id!' } });
    assert.match(replaced.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  });

  test('validation errors return field messages and never echo the submitted value', async () => {
    const res = await h.api('POST', '/api/auth/register', {
      body: { firstName: 'X', lastName: 'Y', email: 'no', password: 'secret-value' },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.errorCode, 'VALIDATION_ERROR');
    assert.ok(res.body.errors.some((error) => error.field === 'password'));
    assert.ok(!res.text.includes('secret-value'));
  });

  test('Prisma codes map to the documented status and error code', () => {
    assert.equal(mapPrismaError({ code: 'P2002' }).statusCode, 409);
    assert.equal(mapPrismaError({ code: 'P2002' }).errorCode, 'CONFLICT');
    assert.equal(mapPrismaError({ code: 'P2025' }).statusCode, 404);
    assert.equal(mapPrismaError({ code: 'P2003' }).statusCode, 409);
    assert.equal(mapPrismaError(new Error('other')), null);
  });

  test('an unknown exception returns 500 without stack, SQL or debug fields', () => {
    const body = {};
    const res = {
      headersSent: false,
      status(code) { body.status = code; return this; },
      json(payload) { body.payload = payload; return this; },
    };
    const req = { id: 'request-abcdefgh', method: 'GET', originalUrl: '/boom' };

    errorHandler(Object.assign(new Error('relation "User" does not exist'), { code: 'XX000' }), req, res, () => {});

    assert.equal(body.status, 500);
    assert.equal(body.payload.errorCode, 'INTERNAL_ERROR');
    assert.equal(body.payload.requestId, 'request-abcdefgh');
    assert.ok(!('debug' in body.payload));
    assert.ok(!('stack' in body.payload));
    assert.ok(!JSON.stringify(body.payload).includes('relation'));
  });
});
