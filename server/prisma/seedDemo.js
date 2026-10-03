// Demo data for LOCAL development only.
//
// Creates a few synthetic accounts, two teams and four reports so the whole
// workflow (citizen -> supervisor -> admin) can be tried on a throwaway database:
//
//   cd server
//   npm run db:push
//   DEMO_PASSWORD='a-long-passphrase' npm run db:seed:demo
//
// Safety rails:
//   - refuses to run unless DATABASE_URL points at this machine (localhost,
//     127.0.0.1 or ::1) and NODE_ENV is not "production"
//   - no password is stored in the repo: pass DEMO_PASSWORD (12+ characters),
//     otherwise a random one is generated and printed once
//   - every row is synthetic: example.com addresses and made-up street names
//   - idempotent: running it again updates the same rows in place (and resets
//     the four demo reports to the status they start with)
//
// Never point this at the hosted database or at the live deployment.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const MIN_PASSWORD_LENGTH = 12;

const DEMO_USERS = [
  { key: 'citizenA', email: 'demo.citizen.a@example.com', lastName: 'Citizen A', role: 'CITIZEN' },
  { key: 'citizenB', email: 'demo.citizen.b@example.com', lastName: 'Citizen B', role: 'CITIZEN' },
  { key: 'supervisor', email: 'demo.supervisor@example.com', lastName: 'Supervisor', role: 'WORKER_SUPERVISOR' },
  { key: 'admin', email: 'demo.admin@example.com', lastName: 'Admin', role: 'MUNICIPAL_ADMIN' },
];

// Specializations use the keywords the supervisor suggestion scoring looks for.
const DEMO_TEAMS = [
  {
    name: 'Demo Roads Crew',
    specialization: 'Roads & Infrastructure',
    municipality: 'City of Johannesburg',
    latitude: -26.2041,
    longitude: 28.0473,
  },
  {
    name: 'Demo Water Crew',
    specialization: 'Water & Sanitation',
    municipality: 'City of Tshwane',
    latitude: -25.7479,
    longitude: 28.2293,
  },
];

const DEMO_REPORTS = [
  {
    owner: 'citizenA',
    title: 'Demo: pothole near Sample Road',
    description: 'Synthetic report. A deep pothole at the corner of Sample Road and Demo Street.',
    category: 'POTHOLE',
    municipality: 'City of Johannesburg',
    address: 'Corner of Sample Road and Demo Street',
    latitude: -26.2051,
    longitude: 28.0483,
    status: 'PENDING',
  },
  {
    owner: 'citizenA',
    title: 'Demo: water leak on Example Avenue',
    description: 'Synthetic report. Water running down the kerb outside number 10 Example Avenue.',
    category: 'WATER_LEAK',
    municipality: 'City of Tshwane',
    address: 'Example Avenue (made-up address)',
    latitude: -25.7489,
    longitude: 28.2303,
    status: 'ASSIGNED',
    team: 'Demo Water Crew',
  },
  {
    owner: 'citizenB',
    title: 'Demo: street light out on Placeholder Road',
    description: 'Synthetic report. The street light has been off for a week.',
    category: 'STREETLIGHT',
    municipality: 'City of Johannesburg',
    address: 'Placeholder Road (made-up address)',
    latitude: -26.1991,
    longitude: 28.0423,
    status: 'IN_PROGRESS',
    team: 'Demo Roads Crew',
  },
  {
    owner: 'citizenB',
    title: 'Demo: illegal dumping behind the sample hall',
    description: 'Synthetic report. Building rubble dumped on the empty plot behind the hall.',
    category: 'ILLEGAL_DUMPING',
    municipality: 'City of Cape Town',
    address: 'Sample Hall, Demo Lane (made-up address)',
    latitude: -33.9249,
    longitude: 18.4241,
    status: 'RESOLVED',
  },
];

function assertLocalOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data while NODE_ENV=production.');
  }

  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set. Point it at a local Postgres database first.');
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL, so it cannot be checked. Refusing to continue.');
  }

  // A "host" or "hostaddr" query parameter can override the host in the URL.
  const overridden = url.searchParams.has('host') || url.searchParams.has('hostaddr');
  if (overridden || !LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Refusing to seed demo data: DATABASE_URL does not point at this machine.');
  }
}

function resolvePassword() {
  const provided = process.env.DEMO_PASSWORD;
  if (provided) {
    if (provided.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`DEMO_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    return { password: provided, generated: false };
  }
  return { password: crypto.randomBytes(12).toString('base64url'), generated: true };
}

async function upsertUsers(prisma, hashedPassword) {
  const users = {};
  for (const u of DEMO_USERS) {
    users[u.key] = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashedPassword, role: u.role, isActive: true, isVerified: true },
      create: {
        email: u.email,
        password: hashedPassword,
        firstName: 'Demo',
        lastName: u.lastName,
        role: u.role,
        isActive: true,
        isVerified: true,
      },
    });
  }
  return users;
}

async function ensureTeams(prisma) {
  const teams = {};
  for (const t of DEMO_TEAMS) {
    const existing = await prisma.team.findFirst({ where: { name: t.name } });
    teams[t.name] = existing
      ? await prisma.team.update({ where: { id: existing.id }, data: { ...t, isActive: true } })
      : await prisma.team.create({ data: t });
  }
  return teams;
}

async function ensureReports(prisma, users, teams) {
  for (const r of DEMO_REPORTS) {
    const { owner, team, ...fields } = r;
    const userId = users[owner].id;
    const assignment = team
      ? { assignedTeamId: teams[team].id, assignedAt: new Date() }
      : { assignedTeamId: null, assignedAt: null };

    const existing = await prisma.report.findFirst({ where: { userId, title: r.title } });
    if (existing) {
      await prisma.report.update({ where: { id: existing.id }, data: { ...fields, ...assignment } });
    } else {
      await prisma.report.create({ data: { ...fields, ...assignment, userId } });
    }
  }
}

async function main() {
  assertLocalOnly();
  const { password, generated } = resolvePassword();

  // Loaded after the safety check: in development this module connects as soon as it is required.
  const prisma = require('../src/config/db.config');

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const users = await upsertUsers(prisma, hashedPassword);
    const teams = await ensureTeams(prisma);
    await ensureReports(prisma, users, teams);
  } finally {
    await prisma.$disconnect();
  }

  console.log('Demo data ready on the local database:');
  for (const u of DEMO_USERS) console.log(`  ${u.email.padEnd(30)} ${u.role}`);
  console.log(`  ${DEMO_TEAMS.length} teams, ${DEMO_REPORTS.length} reports`);
  console.log(
    generated
      ? `Generated password for every demo account (shown once): ${password}`
      : 'Every demo account uses the DEMO_PASSWORD you supplied.'
  );
}

main().catch((err) => {
  console.error('Demo seed failed:', err.message);
  process.exitCode = 1;
});
