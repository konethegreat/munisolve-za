// Creates (or resets) one MUNICIPAL_ADMIN account.
//
// Credentials come from the environment, so no password is stored in the repo:
//
//   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='a-long-passphrase' npm run db:seed
//
// If an account with that email already exists, its password is reset and it is
// re-activated as MUNICIPAL_ADMIN. Run it against the database in DATABASE_URL
// only when you mean to.
//
// For throwaway demo data on a local database see seedDemo.js (npm run db:seed:demo).

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const MIN_PASSWORD_LENGTH = 12;

const prisma = new PrismaClient();

async function main() {
  // The auth controller lower-cases emails on register and login, so store it that way.
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const plainPassword = process.env.SEED_ADMIN_PASSWORD || '';

  if (!email || plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) before running this script.`
    );
  }

  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, role: 'MUNICIPAL_ADMIN', isActive: true, isVerified: true },
    create: {
      email,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'MUNICIPAL_ADMIN',
      isActive: true,
      isVerified: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Admin seeded: ${user.email} (id=${user.id}, role=${user.role})`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
