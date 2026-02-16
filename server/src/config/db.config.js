// Database configuration: lightweight replacement for Prisma
// This file exports a simple `query` wrapper using `pg` (node-postgres).
// If you prefer a different driver or ORM, replace this module accordingly.

const DEBUG = process.env.NODE_ENV === 'development';

let pool;
try {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} catch (err) {
  console.error('[DATABASE] `pg` module not installed. Install it or provide your own DB client.');
  pool = null;
}

if (pool && DEBUG) {
  pool.on('connect', () => console.log('✅ Database pool connected'));
  pool.on('error', (err) => console.error('❌ Database pool error:', err));
}

process.on('SIGINT', async () => {
  if (pool) {
    console.log('\n[DATABASE] Closing database connections...');
    await pool.end();
    console.log('[DATABASE] Database connections closed');
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (pool) {
    console.log('\n[DATABASE] Closing database connections...');
    await pool.end();
    console.log('[DATABASE] Database connections closed');
  }
  process.exit(0);
});

module.exports = {
  query: async (text, params) => {
    if (!pool) throw new Error('No database client available. Install `pg` or replace `db.config.js`.');
    return pool.query(text, params);
  },
  pool,
};