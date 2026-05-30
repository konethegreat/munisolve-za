require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@munisolve.co.za';
  const plainPassword = 'Admin@1234';

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
  console.log(`Login with: ${email} / ${plainPassword}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
