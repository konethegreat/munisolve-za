// ==========================================
// DATABASE CONFIGURATION - PRISMA
// ==========================================
// Centralized Prisma Client initialization
// Author: MuniSolve ZA Development Team
// Last Updated: February 2026

const { PrismaClient } = require('@prisma/client');

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'pretty',
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n[DATABASE] Closing database connections...');
  await prisma.$disconnect();
  console.log('[DATABASE] Database connections closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[DATABASE] Closing database connections...');
  await prisma.$disconnect();
  console.log('[DATABASE] Database connections closed');
  process.exit(0);
});

// Test connection in development
if (process.env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((error) => {
      console.error('❌ Database connection failed:', error.message);
      console.error('💡 Make sure PostgreSQL is running and DATABASE_URL in .env is correct');
      process.exit(1);
    });
}

// Export Prisma Client
module.exports = prisma;