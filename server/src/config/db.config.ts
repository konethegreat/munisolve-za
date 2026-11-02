import { PrismaClient } from '@prisma/client';
import { withRetry } from './retry';
import { logger } from '../logger';

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
});

const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      return withRetry(() => query(args));
    },
  },
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Closing database connections');
  await basePrisma.$disconnect();
  logger.info('Database connections closed');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (process.env.NODE_ENV === 'development') {
  basePrisma.$connect()
    .then(() => {
      logger.info('Database connected');
    })
    .catch((error) => {
      logger.error({ err: error }, 'Database connection failed');
      logger.error('Make sure PostgreSQL is running and DATABASE_URL in .env is correct');
      process.exit(1);
    });
}

export = prisma;
