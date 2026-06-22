// ==========================================
// DATABASE CONFIGURATION - PRISMA
// ==========================================
// Centralized Prisma Client initialization
// Author: MuniSolve ZA Development Team
// Last Updated: February 2026

const { PrismaClient } = require('@prisma/client');
const { withRetry } = require('./retry');

// Initialize Prisma Client
const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
});

// Wrap every query so transient connection drops (e.g. Neon compute
// auto-suspend, which terminates idle connections with Postgres 57P01) are
// retried transparently instead of surfacing as user-facing 500s. Lifecycle
// methods ($connect/$disconnect) stay on the base client below.
const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      return withRetry(() => query(args));
    },
  },
});

// Graceful shutdown handlers
async function shutdown(signal) {
  console.log(`\n[DATABASE] ${signal} received — closing database connections...`);
  await basePrisma.$disconnect();
  console.log('[DATABASE] Database connections closed');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Test connection in development
if (process.env.NODE_ENV === 'development') {
  basePrisma.$connect()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error.message);
      console.error('💡 Make sure PostgreSQL is running and DATABASE_URL in .env is correct');
      process.exit(1);
    });
}

// Export the extended Prisma Client (transparent retry on connection drops)
module.exports = prisma;