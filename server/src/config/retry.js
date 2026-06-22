// ==========================================
// DATABASE RETRY HELPERS
// ==========================================
// Neon (serverless Postgres) auto-suspends its compute after a short idle
// period and terminates any open connections. The first query after a suspend
// grabs a stale pooled connection and fails with Postgres 57P01
// ("terminating connection due to administrator command") or a Prisma
// connection error (P1001/P1002/P1008/P1017). Prisma reconnects immediately
// afterwards, so retrying briefly rides through the drop transparently instead
// of surfacing it to the user as a 500.

// Prisma error codes that signal a transient connectivity issue (safe to retry)
const RETRYABLE_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server reached but timed out
  'P1008', // Operation timed out
  'P1017', // Server has closed the connection
]);

// Raw driver messages (Neon / node-postgres) that indicate a dropped connection
const RETRYABLE_MESSAGE =
  /terminating connection due to administrator command|server has closed the connection|can't reach database server|connection terminated|connection reset|ECONNRESET|ETIMEDOUT/i;

function isRetryableError(error) {
  if (!error) return false;
  // PrismaClientKnownRequestError uses `code`; InitializationError uses `errorCode`
  const code = error.code || error.errorCode;
  if (code && RETRYABLE_CODES.has(code)) return true;
  return RETRYABLE_MESSAGE.test(error.message || '');
}

const DEFAULTS = { retries: 2, baseDelayMs: 150 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs `operation`, retrying only on transient connection errors with
// exponential backoff. Non-retryable errors (validation, unique constraints,
// etc.) are rethrown immediately so application logic is never masked.
async function withRetry(operation, options = {}) {
  const { retries, baseDelayMs } = { ...DEFAULTS, ...options };
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableError(error) || attempt >= retries) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      attempt += 1;
      console.warn(
        `[DATABASE] Transient connection error (${error.code || error.errorCode || 'driver'}). ` +
          `Retry ${attempt}/${retries} in ${delay}ms.`
      );
      await sleep(delay);
    }
  }
}

module.exports = { isRetryableError, withRetry, RETRYABLE_CODES };
