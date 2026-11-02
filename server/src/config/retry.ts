// Neon auto-suspends compute and drops idle connections. Prisma reconnects
// immediately afterwards, so a short retry rides through the drop instead of
// surfacing a 500 for the first query after a suspend.
import { logger } from '../logger';

const RETRYABLE_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server reached but timed out
  'P1008', // Operation timed out
  'P1017', // Server has closed the connection
]);

const RETRYABLE_MESSAGE =
  /terminating connection due to administrator command|server has closed the connection|can't reach database server|connection terminated|connection reset|ECONNRESET|ETIMEDOUT/i;

interface RetryableError {
  code?: string;
  errorCode?: string;
  message?: string;
}

export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as RetryableError;
  const code = candidate.code || candidate.errorCode;
  if (code && RETRYABLE_CODES.has(code)) return true;
  return RETRYABLE_MESSAGE.test(candidate.message || '');
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

const DEFAULTS: Required<RetryOptions> = { retries: 2, baseDelayMs: 150 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries, baseDelayMs } = { ...DEFAULTS, ...options };
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableError(error) || attempt >= retries) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      attempt += 1;
      logger.warn({ attempt, retries, delay }, 'Retrying a transient database connection error');
      await sleep(delay);
    }
  }
}

export { RETRYABLE_CODES };
