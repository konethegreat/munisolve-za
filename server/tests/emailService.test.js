'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const SERVER_ROOT = path.resolve(__dirname, '..');

// The service reads RESEND_API_KEY at import time and keeps a module-level client,
// so the stub and the synthetic key must be in place before it is required.
const providerError = {
  name: 'validation_error',
  message: 'You can only send testing emails to your own email address.',
  statusCode: 403,
};
const resendPath = require.resolve('resend', { paths: [SERVER_ROOT] });
const stub = new Module(resendPath, null);
stub.filename = resendPath;
stub.paths = [];
stub.loaded = true;
stub.exports = {
  Resend: class {
    constructor() {
      this.emails = { send: async () => ({ data: null, error: providerError }) };
    }
  },
};
require.cache[resendPath] = stub;
process.env.RESEND_API_KEY = 'synthetic-test-only';
process.env.RESEND_FROM_EMAIL = 'MuniSolve ZA <onboarding@resend.dev>';

const { sendNotificationEmail, sendVerificationEmail } = require('../src/services/email.service');

test('notification failures keep the provider status and message', async () => {
  await assert.rejects(
    () => sendNotificationEmail({ to: 'citizen@example.test', subject: 'Overdue', text: 'Body' }),
    (error) => {
      assert.match(error.message, /Failed to send notification email/);
      assert.match(error.message, /403/);
      assert.match(error.message, /only send testing emails/);
      return true;
    },
  );
});

test('verification failures keep the provider status and message', async () => {
  await assert.rejects(
    () => sendVerificationEmail('citizen@example.test', 'Citizen', '123456'),
    (error) => {
      assert.match(error.message, /Failed to send verification email/);
      assert.match(error.message, /403/);
      assert.match(error.message, /only send testing emails/);
      return true;
    },
  );
});
