require('dotenv').config({ path: '.env.production' })

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "admin@munisolve.co.za";
  const plainPassword = "Admin@1234";
  const role = "MUNICIPAL_ADMIN";

  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      role,
      firstName: "Admin",
      lastName: "User",
    },
    select: { id: true, email: true, role: true },
  });

  console.log(
    `Admin seed complete: ${user.email} (id=${user.id}, role=${user.role})`
  );
}

main()
  .catch((err) => {
    console.error("Failed to seed admin user:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

