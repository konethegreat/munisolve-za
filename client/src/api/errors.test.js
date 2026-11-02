import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, errorMessage, normalizeApiError } from './errors.js';

test('normalises the flat API envelope and keeps the request id', () => {
  const raw = {
    response: {
      status: 422,
      data: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Title is too short',
        requestId: 'req_123',
        errors: [{ path: 'title', message: 'Too short' }],
      },
    },
  };

  const error = normalizeApiError(raw, 'fallback');

  assert.ok(error instanceof ApiError);
  assert.equal(error.message, 'Title is too short');
  assert.equal(error.status, 422);
  assert.equal(error.errorCode, 'VALIDATION_ERROR');
  assert.equal(error.requestId, 'req_123');
  assert.equal(error.errors.length, 1);
  assert.equal(error.reference, 'Reference req_123');
});

test('falls back to the response header when the body has no request id', () => {
  const error = normalizeApiError({
    response: {
      status: 500,
      headers: { 'x-request-id': 'req_header' },
      data: { success: false, errorCode: 'INTERNAL_ERROR', message: 'Boom' },
    },
  });

  assert.equal(error.requestId, 'req_header');
});

test('turns a network failure into a readable message', () => {
  const error = normalizeApiError({ message: 'Network Error' });
  assert.equal(error.status, 0);
  assert.equal(error.errorCode, 'NETWORK_ERROR');
  assert.match(error.message, /Cannot reach the MuniSolve API/);
});

test('keeps an existing ApiError untouched', () => {
  const original = new ApiError('Already normalised', { status: 400 });
  assert.equal(normalizeApiError(original), original);
});

test('errorMessage uses the fallback for unknown shapes', () => {
  assert.equal(errorMessage({}, 'Please try again.'), 'Please try again.');
});
