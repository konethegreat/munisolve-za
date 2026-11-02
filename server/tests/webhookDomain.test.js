'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  WEBHOOK_EVENTS,
  isBlockedAddress,
  parseWebhookUrl,
  signWebhook,
  subscriptionWantsEvent,
} = require('../src/domain/webhook');

describe('webhook domain', () => {
  test('signs the timestamp and exact body with HMAC-SHA256', () => {
    const signature = signWebhook('whsec_test', '1700000000', '{"event":"report.created"}');
    const expected = crypto
      .createHmac('sha256', 'whsec_test')
      .update('1700000000.{"event":"report.created"}')
      .digest('hex');
    assert.equal(signature, expected);
    assert.match(signature, /^[0-9a-f]{64}$/);
    assert.notEqual(signature, signWebhook('whsec_test', '1700000001', '{"event":"report.created"}'));
  });

  test('accepts a public HTTPS subscription URL', () => {
    const result = parseWebhookUrl('https://hooks.example.com/munisolve');
    assert.equal(result.ok, true);
    assert.equal(result.url, 'https://hooks.example.com/munisolve');
  });

  test('rejects plain HTTP, credentials and unusual ports', () => {
    assert.equal(parseWebhookUrl('http://hooks.example.com/x').reason, 'HTTPS_REQUIRED');
    assert.equal(parseWebhookUrl('https://user:pass@hooks.example.com/x').reason, 'CREDENTIALS_NOT_ALLOWED');
    assert.equal(parseWebhookUrl('https://hooks.example.com:8443/x').reason, 'PORT_NOT_ALLOWED');
    assert.equal(parseWebhookUrl('not a url').reason, 'INVALID_URL');
  });

  test('rejects local and internal hostnames before any DNS lookup', () => {
    for (const raw of [
      'https://localhost/hook',
      'https://api.localhost/hook',
      'https://printer.local/hook',
      'https://metadata.google.internal/hook',
    ]) {
      assert.equal(parseWebhookUrl(raw).reason, 'PRIVATE_HOST', raw);
    }
  });

  test('rejects private, loopback and metadata IP literals', () => {
    for (const raw of [
      'https://127.0.0.1/hook',
      'https://10.1.2.3/hook',
      'https://172.16.0.1/hook',
      'https://192.168.1.10/hook',
      'https://169.254.169.254/latest/meta-data',
      'https://100.64.0.1/hook',
      'https://[::1]/hook',
      'https://[fd00::1]/hook',
      'https://[fe80::1]/hook',
    ]) {
      assert.equal(parseWebhookUrl(raw).reason, 'PRIVATE_ADDRESS', raw);
    }
    assert.equal(parseWebhookUrl('https://[2001:db8::1]/hook').ok, true);
  });

  test('classifies addresses for the delivery-time DNS check', () => {
    assert.equal(isBlockedAddress('8.8.8.8'), false);
    assert.equal(isBlockedAddress('0.0.0.0'), true);
    assert.equal(isBlockedAddress('198.18.0.1'), true);
    assert.equal(isBlockedAddress('224.0.0.1'), true);
    assert.equal(isBlockedAddress('::ffff:192.168.0.1'), true);
    assert.equal(isBlockedAddress('::'), true);
    assert.equal(isBlockedAddress('2001:4860:4860::8888'), false);
    assert.equal(isBlockedAddress('not-an-ip'), true);
  });

  test('matches a comma-separated event list', () => {
    assert.deepEqual(WEBHOOK_EVENTS, [
      'report.created',
      'report.assigned',
      'report.status_changed',
      'report.merged',
      'report.unmerged',
    ]);
    assert.equal(subscriptionWantsEvent('report.created,report.merged', 'report.merged'), true);
    assert.equal(subscriptionWantsEvent('report.created', 'report.merged'), false);
    assert.equal(subscriptionWantsEvent('*', 'report.merged'), true);
  });
});
