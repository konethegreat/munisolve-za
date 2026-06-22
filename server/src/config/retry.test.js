// Standalone test for the DB retry helpers.
// No test framework is configured, so run directly:  node src/config/retry.test.js
const assert = require('node:assert');
const { isRetryableError, withRetry } = require('./retry');

(async () => {
  let passed = 0;
  const ok = (name) => {
    console.log(`✓ ${name}`);
    passed += 1;
  };

  // --- isRetryableError ---
  assert.equal(isRetryableError({ code: 'P1017' }), true);
  ok('P1017 (server closed connection) is retryable');

  assert.equal(
    isRetryableError({ message: 'terminating connection due to administrator command' }),
    true
  );
  ok('Neon 57P01 message is retryable');

  assert.equal(isRetryableError({ errorCode: 'P1001' }), true);
  ok('P1001 via InitializationError.errorCode is retryable');

  assert.equal(isRetryableError({ code: 'P2002', message: 'Unique constraint failed' }), false);
  ok('unique-constraint violation is NOT retryable');

  assert.equal(isRetryableError(null), false);
  ok('null/undefined is not retryable');

  // --- withRetry: recovers after transient drops ---
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error('terminating connection due to administrator command');
      return 'ok';
    },
    { retries: 2, baseDelayMs: 1 }
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3); // 1 initial + 2 retries
  ok('withRetry recovers after transient connection drops');

  // --- withRetry: rethrows non-retryable immediately (no retry) ---
  let calls2 = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls2 += 1;
          const e = new Error('Unique constraint failed');
          e.code = 'P2002';
          throw e;
        },
        { retries: 2, baseDelayMs: 1 }
      ),
    /Unique constraint failed/
  );
  assert.equal(calls2, 1);
  ok('withRetry does not retry non-retryable errors');

  // --- withRetry: gives up after exhausting retries ---
  let calls3 = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls3 += 1;
          throw new Error('connection terminated unexpectedly');
        },
        { retries: 2, baseDelayMs: 1 }
      ),
    /connection terminated/
  );
  assert.equal(calls3, 3); // 1 initial + 2 retries, then rethrow
  ok('withRetry gives up and rethrows after exhausting retries');

  console.log(`\n${passed} checks passed.`);
})().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
