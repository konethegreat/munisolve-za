import prisma from '../config/db.config';

type DatabaseCheck = 'up' | 'down';
type MigrationCheck = 'current' | 'pending' | 'unknown';

export interface ReadinessResult {
  ready: boolean;
  checks: {
    database: DatabaseCheck;
    migrations: MigrationCheck;
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('database check timed out')), ms);
    timer.unref();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function getReadiness(): Promise<ReadinessResult> {
  const checks: ReadinessResult['checks'] = { database: 'down', migrations: 'unknown' };

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
    checks.database = 'up';
  } catch {
    return { ready: false, checks };
  }

  try {
    // Same bound as the connection check: a wedged migrations query must not hold readiness open.
    const rows = await withTimeout(
      prisma.$queryRaw<Array<{ failed: number }>>`
        SELECT COUNT(*)::int AS failed
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
      `,
      2000,
    );
    checks.migrations = Number(rows[0]?.failed ?? 0) > 0 ? 'pending' : 'current';
  } catch {
    checks.migrations = 'unknown';
  }

  return {
    ready: checks.database === 'up' && checks.migrations === 'current',
    checks,
  };
}
