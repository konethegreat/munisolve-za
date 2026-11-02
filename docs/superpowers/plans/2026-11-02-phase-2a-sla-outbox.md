# MuniSolve ZA Phase 2A: SLA Policies and Notification Outbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every report category a response and resolution target, add an hourly authenticated tick that records warnings and breaches in a durable outbox, and deliver those notifications by email with retries.

**Architecture:** A pure planner in `server/src/domain/sla.ts` turns open reports plus the current time into notification drafts. Services enqueue them into a PostgreSQL outbox with a unique dedupe key and process due rows by claiming, sending through Resend, and recording success or retry. A GitHub Actions schedule calls `POST /api/internal/tick` hourly to stay inside the Neon free compute budget.

**Tech Stack:** TypeScript (new files), Express 5, Prisma 6 / PostgreSQL, Resend, node:test with the existing fake Prisma and harness, GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-11-02-phase-2a-sla-outbox-design.md](../specs/2026-11-02-phase-2a-sla-outbox-design.md)

## Global Constraints

- Free tiers only: Render free, Neon free, Vercel Hobby, Resend free. No paid cron, Redis or queue.
- The tick runs hourly (`5 * * * *`), never every five minutes. Five-minute ticks would keep Neon compute awake 24/7 and exceed its monthly free hours.
- Keep the existing success envelope and every existing API path. Response shapes only gain the new report fields.
- New source files are TypeScript. Existing JavaScript changes only where this phase needs it.
- No secrets in code, tests, logs, commits or API responses. `TICK_SECRET` lives only in Render and GitHub Actions secrets.
- Every mutating path stays transactional where Phase 1 made it transactional. Do not weaken the conditional status guards.
- Email content is built from user-supplied report titles. Escape it before it enters HTML.
- Use `prisma migrate deploy`; never `db push` against a shared database.
- Run commands from `server/` unless a step says otherwise.

---

### Task 1: Schema, migration and generated client

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20261102020000_phase_2a_sla_outbox/migration.sql`

**Interfaces:**
- Produces: Prisma models `SlaPolicy` and `NotificationOutbox`, and `Report.responseDueAt`, `Report.resolutionDueAt`, `Report.slaCycleStartedAt`.
- Produces: seeded policy rows for all eleven categories.

- [ ] **Step 1: Add the schema models and report fields**

Append these models to `server/prisma/schema.prisma`:

```prisma
model SlaPolicy {
  id                Int      @id @default(autoincrement())
  category          String   @unique
  responseMinutes   Int
  resolutionMinutes Int
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model NotificationOutbox {
  id             Int      @id @default(autoincrement())
  dedupeKey      String   @unique
  kind           String
  reportId       Int?
  report         Report?  @relation(fields: [reportId], references: [id], onDelete: Cascade)
  recipientEmail String
  subject        String
  body           String
  status         String   @default("PENDING")
  attempts       Int      @default(0)
  maxAttempts    Int      @default(5)
  nextAttemptAt  DateTime @default(now())
  sentAt         DateTime?
  lastError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([status, nextAttemptAt])
  @@index([reportId])
}
```

In the `Report` model, add these fields after `reopenCount`:

```prisma
  responseDueAt     DateTime?
  resolutionDueAt   DateTime?
  slaCycleStartedAt DateTime?
```

In the `Report` model's relation list, add:

```prisma
  notifications    NotificationOutbox[]
```

- [ ] **Step 2: Write the migration**

Create `server/prisma/migrations/20261102020000_phase_2a_sla_outbox/migration.sql`:

```sql
SET lock_timeout = '5s';

-- CreateTable
CREATE TABLE "SlaPolicy" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "responseMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" SERIAL NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reportId" INTEGER,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "responseDueAt" TIMESTAMP(3),
ADD COLUMN     "resolutionDueAt" TIMESTAMP(3),
ADD COLUMN     "slaCycleStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "SlaPolicy_category_key" ON "SlaPolicy"("category");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_nextAttemptAt_idx" ON "NotificationOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_reportId_idx" ON "NotificationOutbox"("reportId");

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the default policies once. Changing a target later is a new migration.
INSERT INTO "SlaPolicy" ("category", "responseMinutes", "resolutionMinutes", "isActive", "createdAt", "updatedAt") VALUES
    ('ELECTRICITY_OUTAGE', 120, 4320, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('WATER_LEAK', 240, 4320, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('SEWAGE', 480, 4320, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('TRAFFIC_LIGHT', 480, 14400, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('REFUSE_COLLECTION', 1440, 7200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('POTHOLE', 2880, 43200, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('STREETLIGHT', 2880, 30240, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('ILLEGAL_DUMPING', 2880, 10080, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('GRAFFITI', 4320, 20160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PARK_MAINTENANCE', 4320, 20160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('OTHER', 4320, 20160, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("category") DO NOTHING;

-- Backfill existing reports from their category policy.
UPDATE "Report" AS r
SET "responseDueAt" = COALESCE(r."responseDueAt", r."createdAt" + make_interval(mins => p."responseMinutes")),
    "resolutionDueAt" = COALESCE(r."resolutionDueAt", r."createdAt" + make_interval(mins => p."resolutionMinutes")),
    "slaCycleStartedAt" = COALESCE(r."slaCycleStartedAt", r."createdAt")
FROM "SlaPolicy" AS p
WHERE p."category" = r."category";

-- Rows whose category has no policy still need a window: 72 h response, 14 days resolution.
UPDATE "Report"
SET "responseDueAt" = COALESCE("responseDueAt", "createdAt" + INTERVAL '72 hours'),
    "resolutionDueAt" = COALESCE("resolutionDueAt", "createdAt" + INTERVAL '336 hours'),
    "slaCycleStartedAt" = COALESCE("slaCycleStartedAt", "createdAt")
WHERE "responseDueAt" IS NULL OR "resolutionDueAt" IS NULL OR "slaCycleStartedAt" IS NULL;
```

- [ ] **Step 3: Generate the client and verify the migration against a disposable database**

Run from `server/`:

```bash
npx prisma generate
docker run --rm -d --name munisolve-p2a-check -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=munisolve_check -p 127.0.0.1::5432 postgres:16-alpine
PORT="$(docker port munisolve-p2a-check 5432/tcp | sed 's/.*://')"
export DATABASE_URL="postgresql://postgres:test@127.0.0.1:${PORT}/munisolve_check"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
npx prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --exit-code
docker rm -f munisolve-p2a-check
```

Expected: `migrate deploy` applies the baseline, Phase 1 and Phase 2A; `migrate diff --exit-code` exits 0 with no drift.

- [ ] **Step 4: Run the existing suite**

Run: `npm test`
Expected: all existing tests pass. The new models are unused so far.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261102020000_phase_2a_sla_outbox
git commit -m "feat(db): add SLA policies and notification outbox"
```

---

### Task 2: Pure SLA planner

**Files:**
- Create: `server/src/domain/sla.ts`
- Test: `server/tests/sla.test.js`

**Interfaces:**
- Produces: `NotificationKind`, `SlaPolicyValues`, `DEFAULT_SLA_POLICY`, `SLA_WARNING_RATIO`, `OPEN_REPORT_STATUSES`, `SlaPerson`, `SlaReport`, `NotificationDraft`, `PlanOptions`, `dueWarningAt(start, due, ratio?)`, `addMinutes(date, minutes)`, `planSlaNotifications(options)`.
- Consumes: nothing. This module imports no Prisma and reads no clock.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/sla.test.js`:

```js
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SLA_POLICY,
  dueWarningAt,
  planSlaNotifications,
} = require('../src/domain/sla');

const NOW = new Date('2026-11-02T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CLIENT = 'https://client.example.test/';

function report(overrides = {}) {
  return {
    id: 7,
    title: 'Pothole on Main Road',
    category: 'POTHOLE',
    municipality: 'City of Johannesburg',
    status: 'PENDING',
    createdAt: new Date(NOW.getTime() - 5 * HOUR),
    assignedAt: null,
    responseDueAt: new Date(NOW.getTime() + HOUR),
    resolutionDueAt: new Date(NOW.getTime() + 10 * DAY),
    slaCycleStartedAt: new Date(NOW.getTime() - 5 * HOUR),
    reopenCount: 0,
    user: { email: 'citizen@example.com', firstName: 'Thandi' },
    ...overrides,
  };
}

const admins = [
  { email: 'admin@example.com', firstName: 'Ayanda' },
  { email: 'Admin@Example.com', firstName: 'Ayanda' },
];

function plan(reports, people = admins) {
  return planSlaNotifications({ now: NOW, reports, admins: people, clientUrl: CLIENT });
}

describe('SLA planner', () => {
  test('the defaults are 72 hours and 14 days', () => {
    assert.deepEqual(DEFAULT_SLA_POLICY, { responseMinutes: 4320, resolutionMinutes: 20160 });
  });

  test('the warning point is 80 percent of the window', () => {
    const start = new Date(0);
    const due = new Date(100_000);
    assert.equal(dueWarningAt(start, due).getTime(), 80_000);
  });

  test('a response warning goes to the owner only', () => {
    const drafts = plan([report()]);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, 'SLA_RESPONSE_WARNING');
    assert.equal(drafts[0].recipientEmail, 'citizen@example.com');
    assert.equal(drafts[0].dedupeKey, 'sla:SLA_RESPONSE_WARNING:r7:c0:citizen@example.com');
    assert.match(drafts[0].body, /https:\/\/client\.example\.test\/reports\/7/);
  });

  test('a response breach alerts the owner and each admin once', () => {
    const drafts = plan([
      report({ responseDueAt: new Date(NOW.getTime() - HOUR) }),
    ]);
    assert.deepEqual(
      drafts.map((draft) => [draft.kind, draft.recipientEmail]).sort(),
      [
        ['SLA_RESPONSE_BREACH', 'admin@example.com'],
        ['SLA_RESPONSE_BREACH', 'citizen@example.com'],
      ],
    );
  });

  test('an assigned report no longer has a response SLA', () => {
    const drafts = plan([
      report({
        status: 'ASSIGNED',
        assignedAt: new Date(NOW.getTime() - 2 * HOUR),
        responseDueAt: new Date(NOW.getTime() - HOUR),
      }),
    ]);
    assert.deepEqual(drafts, []);
  });

  test('a resolution warning uses the cycle start after a reopen', () => {
    const drafts = plan([
      report({
        status: 'IN_PROGRESS',
        assignedAt: new Date(NOW.getTime() - 3 * DAY),
        resolutionDueAt: new Date(NOW.getTime() + HOUR),
        slaCycleStartedAt: new Date(NOW.getTime() - 9 * HOUR),
        reopenCount: 2,
      }),
    ]);
    assert.deepEqual(drafts.map((draft) => [draft.kind, draft.dedupeKey]), [
      ['SLA_RESOLUTION_WARNING', 'sla:SLA_RESOLUTION_WARNING:r7:c2:citizen@example.com'],
    ]);
  });

  test('a resolution breach alerts admins and includes the cycle in the key', () => {
    const drafts = plan([
      report({
        status: 'IN_PROGRESS',
        assignedAt: new Date(NOW.getTime() - 3 * DAY),
        resolutionDueAt: new Date(NOW.getTime() - 1),
        reopenCount: 1,
      }),
    ]);
    assert.equal(drafts.length, 2);
    assert.ok(drafts.every((draft) => draft.kind === 'SLA_RESOLUTION_BREACH'));
    assert.ok(drafts.every((draft) => draft.dedupeKey.includes(':c1:')));
  });

  test('finished reports are ignored even when overdue', () => {
    for (const status of ['RESOLVED', 'CLOSED', 'REJECTED']) {
      const drafts = plan([
        report({
          status,
          responseDueAt: new Date(NOW.getTime() - DAY),
          resolutionDueAt: new Date(NOW.getTime() - DAY),
        }),
      ]);
      assert.deepEqual(drafts, [], `${status} must not notify`);
    }
  });

  test('an admin who owns the report is not emailed twice', () => {
    const drafts = plan(
      [report({ user: { email: 'admin@example.com', firstName: 'Ayanda' }, responseDueAt: new Date(NOW.getTime() - HOUR) })],
      [{ email: 'ADMIN@example.com', firstName: 'Ayanda' }],
    );
    assert.equal(drafts.length, 1);
  });

  test('reports without due dates are skipped', () => {
    const drafts = plan([report({ responseDueAt: null, resolutionDueAt: null })]);
    assert.deepEqual(drafts, []);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test tests/sla.test.js`
Expected: FAIL with `Cannot find module '../src/domain/sla'`.

- [ ] **Step 3: Implement the planner**

Create `server/src/domain/sla.ts`:

```ts
export type NotificationKind =
  | 'SLA_RESPONSE_WARNING'
  | 'SLA_RESPONSE_BREACH'
  | 'SLA_RESOLUTION_WARNING'
  | 'SLA_RESOLUTION_BREACH';

export interface SlaPolicyValues {
  responseMinutes: number;
  resolutionMinutes: number;
}

export const DEFAULT_SLA_POLICY: SlaPolicyValues = {
  responseMinutes: 72 * 60,
  resolutionMinutes: 14 * 24 * 60,
};

export const SLA_WARNING_RATIO = 0.8;

export const OPEN_REPORT_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] as const;
const OPEN_STATUS_SET = new Set<string>(OPEN_REPORT_STATUSES);

export interface SlaPerson {
  email: string;
  firstName: string;
}

export interface SlaReport {
  id: number;
  title: string;
  category: string;
  municipality: string;
  status: string;
  createdAt: Date;
  assignedAt: Date | null;
  responseDueAt: Date | null;
  resolutionDueAt: Date | null;
  slaCycleStartedAt: Date | null;
  reopenCount: number;
  user: SlaPerson;
}

export interface NotificationDraft {
  dedupeKey: string;
  kind: NotificationKind;
  reportId: number;
  recipientEmail: string;
  subject: string;
  body: string;
}

export interface PlanOptions {
  now: Date;
  reports: SlaReport[];
  admins: SlaPerson[];
  clientUrl: string;
  warningRatio?: number;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function dueWarningAt(start: Date, due: Date, ratio = SLA_WARNING_RATIO): Date {
  return new Date(start.getTime() + ratio * (due.getTime() - start.getTime()));
}

type Target = 'response' | 'resolution';

function formatDue(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function reportLink(clientUrl: string, reportId: number): string {
  return `${clientUrl.replace(/\/$/, '')}/reports/${reportId}`;
}

function reportLabel(report: SlaReport): string {
  return `#${report.id} "${report.title}" (${report.category}) in ${report.municipality}`;
}

function ownerWarning(report: SlaReport, target: Target, dueAt: Date, clientUrl: string): { subject: string; body: string } {
  const next = target === 'response'
    ? 'A municipal crew has not been assigned yet.'
    : 'The municipality is still working on it.';
  return {
    subject: `Report #${report.id} is nearing its ${target} target`,
    body: [
      `Hi ${report.user.firstName || 'there'},`,
      `Your report ${reportLabel(report)} is approaching its ${target} target of ${formatDue(dueAt)}.`,
      next,
      `View the report: ${reportLink(clientUrl, report.id)}`,
    ].join('\n\n'),
  };
}

function ownerBreach(report: SlaReport, target: Target, dueAt: Date, clientUrl: string): { subject: string; body: string } {
  return {
    subject: `Report #${report.id} is past its ${target} target`,
    body: [
      `Hi ${report.user.firstName || 'there'},`,
      `Your report ${reportLabel(report)} has passed its ${target} target, which was due ${formatDue(dueAt)}.`,
      'The municipality has been notified.',
      `View the report: ${reportLink(clientUrl, report.id)}`,
    ].join('\n\n'),
  };
}

function adminBreach(report: SlaReport, target: Target, dueAt: Date, clientUrl: string): { subject: string; body: string } {
  return {
    subject: `SLA breach: report #${report.id} (${report.category})`,
    body: [
      `Report ${reportLabel(report)} has passed its ${target} target, due ${formatDue(dueAt)}.`,
      `Report owner: ${report.user.email}`,
      `Open the report: ${reportLink(clientUrl, report.id)}`,
    ].join('\n\n'),
  };
}

export function planSlaNotifications({
  now,
  reports,
  admins,
  clientUrl,
  warningRatio = SLA_WARNING_RATIO,
}: PlanOptions): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const seen = new Set<string>();

  const push = (report: SlaReport, kind: NotificationKind, target: Target, recipient: SlaPerson, dueAt: Date, content: { subject: string; body: string }) => {
    const email = recipient.email.trim().toLowerCase();
    if (!email) return;
    const dedupeKey = `sla:${kind}:r${report.id}:c${report.reopenCount}:${email}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    drafts.push({
      dedupeKey,
      kind,
      reportId: report.id,
      recipientEmail: email,
      subject: content.subject,
      body: content.body,
    });
  };

  const adminRecipients = Array.from(
    new Map(admins.map((admin) => [admin.email.trim().toLowerCase(), admin])).values(),
  );

  for (const report of reports) {
    if (!OPEN_STATUS_SET.has(report.status)) continue;

    if (report.status === 'PENDING' && !report.assignedAt && report.responseDueAt) {
      const warningAt = dueWarningAt(report.createdAt, report.responseDueAt, warningRatio);
      if (now >= report.responseDueAt) {
        push(report, 'SLA_RESPONSE_BREACH', 'response', report.user, report.responseDueAt, ownerBreach(report, 'response', report.responseDueAt, clientUrl));
        for (const admin of adminRecipients) {
          push(report, 'SLA_RESPONSE_BREACH', 'response', admin, report.responseDueAt, adminBreach(report, 'response', report.responseDueAt, clientUrl));
        }
      } else if (now >= warningAt) {
        push(report, 'SLA_RESPONSE_WARNING', 'response', report.user, report.responseDueAt, ownerWarning(report, 'response', report.responseDueAt, clientUrl));
      }
    }

    if (report.resolutionDueAt) {
      const start = report.slaCycleStartedAt ?? report.createdAt;
      const warningAt = dueWarningAt(start, report.resolutionDueAt, warningRatio);
      if (now >= report.resolutionDueAt) {
        push(report, 'SLA_RESOLUTION_BREACH', 'resolution', report.user, report.resolutionDueAt, ownerBreach(report, 'resolution', report.resolutionDueAt, clientUrl));
        for (const admin of adminRecipients) {
          push(report, 'SLA_RESOLUTION_BREACH', 'resolution', admin, report.resolutionDueAt, adminBreach(report, 'resolution', report.resolutionDueAt, clientUrl));
        }
      } else if (now >= warningAt) {
        push(report, 'SLA_RESOLUTION_WARNING', 'resolution', report.user, report.resolutionDueAt, ownerWarning(report, 'resolution', report.resolutionDueAt, clientUrl));
      }
    }
  }

  return drafts;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test tests/sla.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/sla.ts tests/sla.test.js
git commit -m "feat(sla): add pure due-date planner"
```

---

### Task 3: Fake Prisma support for the new models

**Files:**
- Modify: `server/tests/helpers/fakePrisma.js`
- Test: `server/tests/fakePrisma.test.js`

**Interfaces:**
- Produces: fake delegates `slaPolicy` and `notificationOutbox`; filter operators `lt`, `lte`, `gt`, `gte`, `notIn`, `not`; top-level `OR`; `createMany({ data, skipDuplicates })`; unique `dedupeKey` and `category`; cascade from a deleted report.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/fakePrisma.test.js`:

```js
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakePrisma } = require('./helpers/fakePrisma');

function notification(overrides = {}) {
  return {
    dedupeKey: 'sla:TEST:r1:c0:person@example.com',
    kind: 'SLA_RESOLUTION_BREACH',
    recipientEmail: 'person@example.com',
    subject: 'Subject',
    body: 'Body',
    ...overrides,
  };
}

describe('fake Prisma Phase 2A support', () => {
  test('comparison filters select rows inside a date range', async () => {
    const db = createFakePrisma();
    const now = new Date('2026-11-02T12:00:00.000Z');
    db.add('notificationOutbox', notification({ nextAttemptAt: new Date('2026-11-02T11:00:00.000Z') }));
    db.add('notificationOutbox', notification({ dedupeKey: 'other', nextAttemptAt: new Date('2026-11-02T13:00:00.000Z') }));

    const rows = await db.notificationOutbox.findMany({ where: { nextAttemptAt: { lte: now } } });
    assert.equal(rows.length, 1);
  });

  test('OR selects either status', async () => {
    const db = createFakePrisma();
    const now = new Date('2026-11-02T12:00:00.000Z');
    db.add('notificationOutbox', notification({ status: 'PENDING', nextAttemptAt: now }));
    db.add('notificationOutbox', notification({ dedupeKey: 'b', status: 'SENDING', nextAttemptAt: now }));
    db.add('notificationOutbox', notification({ dedupeKey: 'c', status: 'SENT', nextAttemptAt: now }));

    const rows = await db.notificationOutbox.findMany({
      where: { OR: [{ status: 'PENDING' }, { status: 'SENDING' }], nextAttemptAt: { lte: now } },
    });
    assert.deepEqual(rows.map((row) => row.status).sort(), ['PENDING', 'SENDING']);
  });

  test('createMany skipDuplicates honours the dedupe key', async () => {
    const db = createFakePrisma();
    const first = await db.notificationOutbox.createMany({ data: [notification()], skipDuplicates: true });
    const second = await db.notificationOutbox.createMany({ data: [notification()], skipDuplicates: true });
    assert.equal(first.count, 1);
    assert.equal(second.count, 0);
    assert.equal(db.tables.notificationOutbox.length, 1);
  });

  test('deleting a report removes its notifications', async () => {
    const db = createFakePrisma();
    const user = db.add('user', { email: 'u@example.com', password: 'x', firstName: 'A', lastName: 'B' });
    const report = db.add('report', { title: 'T', description: 'D', category: 'POTHOLE', municipality: 'M', userId: user.id });
    db.add('notificationOutbox', notification({ reportId: report.id }));

    await db.report.delete({ where: { id: report.id } });
    assert.equal(db.tables.notificationOutbox.length, 0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test tests/fakePrisma.test.js`
Expected: FAIL with `fakePrisma: unsupported where operator` or an unknown model.

- [ ] **Step 3: Extend the fake**

In `server/tests/helpers/fakePrisma.js`, update the model list and defaults:

```js
const MODELS = ['user', 'report', 'team', 'activityLog', 'reportStatusHistory', 'slaPolicy', 'notificationOutbox'];

const REQUIRED = {
  user: ['email', 'password', 'firstName', 'lastName'],
  report: ['title', 'description', 'category', 'municipality', 'userId'],
  team: ['name', 'specialization'],
  activityLog: ['userId', 'action', 'entity', 'entityId'],
  reportStatusHistory: ['reportId', 'toStatus'],
  slaPolicy: ['category', 'responseMinutes', 'resolutionMinutes'],
  notificationOutbox: ['dedupeKey', 'kind', 'recipientEmail', 'subject', 'body'],
};
```

Extend `RELATIONS`:

```js
  report: {
    user: { model: 'user', fk: 'userId', many: false },
    team: { model: 'team', fk: 'assignedTeamId', many: false },
    history: { model: 'reportStatusHistory', fk: 'reportId', many: true },
    notifications: { model: 'notificationOutbox', fk: 'reportId', many: true },
  },
  notificationOutbox: { report: { model: 'report', fk: 'reportId', many: false } },
  slaPolicy: {},
```

Extend `DEFAULTS`:

```js
  report: () => ({
    status: 'PENDING',
    address: null,
    latitude: null,
    longitude: null,
    weatherTemp: null,
    weatherCondition: null,
    weatherRainfall: null,
    weatherWind: null,
    weatherHumidity: null,
    assignedTeamId: null,
    assignedAt: null,
    afterPhotoUrl: null,
    resolvedAt: null,
    closedAt: null,
    reopenCount: 0,
    responseDueAt: null,
    resolutionDueAt: null,
    slaCycleStartedAt: null,
  }),
  slaPolicy: () => ({ isActive: true }),
  notificationOutbox: () => ({
    reportId: null,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    nextAttemptAt: null,
    sentAt: null,
    lastError: null,
  }),
```

Extend the comparison operators inside `matches`, before the `contains` branch:

```js
      if (Array.isArray(condition.in)) return condition.in.includes(value);
      if (Array.isArray(condition.notIn)) return !condition.notIn.includes(value);
      if ('lt' in condition) return value != null && value < condition.lt;
      if ('lte' in condition) return value != null && value <= condition.lte;
      if ('gt' in condition) return value != null && value > condition.gt;
      if ('gte' in condition) return value != null && value >= condition.gte;
      if ('not' in condition) return value !== condition.not;
```

Replace the first line of `matches` body's object iterator with support for `OR` by changing `find`:

```js
  function find(model, where = {}) {
    if (Array.isArray(where.OR)) {
      const { OR, ...rest } = where;
      const branches = OR.flatMap((branch) => find(model, branch));
      const base = Object.keys(rest).length > 0 ? new Set(find(model, rest)) : null;
      const unique = new Map(branches.map((row) => [row.id, row]));
      return [...unique.values()].filter((row) => !base || base.has(row));
    }
    return tables[model].filter((row) => matches(row, where));
  }
```

Add unique and foreign-key checks inside `insert`, after the existing user email check:

```js
    if (model === 'slaPolicy' && tables.slaPolicy.some((row) => row.category === data.category)) {
      throw prismaError('P2002', 'Unique constraint failed on the fields: (`category`)');
    }
    if (model === 'notificationOutbox' && tables.notificationOutbox.some((row) => row.dedupeKey === data.dedupeKey)) {
      throw prismaError('P2002', 'Unique constraint failed on the fields: (`dedupeKey`)');
    }
    if (model === 'notificationOutbox' && data.reportId != null) {
      if (!tables.report.some((r) => r.id === data.reportId)) {
        throw prismaError('P2003', 'Foreign key constraint violated on `reportId`');
      }
    }
```

Add cascade in the `delete` delegate where reports are handled:

```js
        if (model === 'report') {
          tables.reportStatusHistory = tables.reportStatusHistory.filter((history) => history.reportId !== row.id);
          tables.notificationOutbox = tables.notificationOutbox.filter((notice) => notice.reportId !== row.id);
        }
```

Add `createMany` to the delegate, after `create`:

```js
      async createMany({ data, skipDuplicates = false } = {}) {
        let count = 0;
        for (const item of data) {
          if (
            skipDuplicates &&
            model === 'notificationOutbox' &&
            tables.notificationOutbox.some((row) => row.dedupeKey === item.dedupeKey)
          ) {
            continue;
          }
          insert(model, item);
          count += 1;
        }
        return { count };
      },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test tests/fakePrisma.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/fakePrisma.js tests/fakePrisma.test.js
git commit -m "test: teach the fake Prisma about SLA and outbox rows"
```

---

### Task 4: Notification email and outbox service

**Files:**
- Modify: `server/src/services/email.service.js`
- Create: `server/src/services/notification.service.ts`
- Test: `server/tests/outbox.test.js`

**Interfaces:**
- Consumes: `NotificationDraft`, `addMinutes` from `src/domain/sla.ts`.
- Produces: `sendNotificationEmail({ to, subject, text })`, `isEmailConfigured()`, `retryDelayMinutes(attempts)`, `enqueueNotifications(drafts, now, client?)`, `processOutbox(options)`, `runTick(options)`, types `SendEmail`, `TickOptions`, `TickSummary`.
- Produces: statuses `PENDING`, `SENDING`, `SENT`, `FAILED`, `SKIPPED`; lease `LEASE_MINUTES = 10`; `OUTBOX_BATCH_SIZE = 25`; `MAX_ATTEMPTS = 5`.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/outbox.test.js`:

```js
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createFakePrisma } = require('./helpers/fakePrisma');
const {
  enqueueNotifications,
  processOutbox,
  retryDelayMinutes,
  runTick,
} = require('../src/services/notification.service');

const NOW = new Date('2026-11-02T12:00:00.000Z');
const MINUTE = 60 * 1000;

function draft(overrides = {}) {
  return {
    dedupeKey: 'sla:SLA_RESOLUTION_BREACH:r7:c0:citizen@example.com',
    kind: 'SLA_RESOLUTION_BREACH',
    reportId: null,
    recipientEmail: 'citizen@example.com',
    subject: 'Report #7 is overdue',
    body: 'Your report is overdue.',
    ...overrides,
  };
}

function outbox(db) {
  return db.tables.notificationOutbox;
}

describe('notification outbox', () => {
  test('backoff starts at five minutes and caps at six hours', () => {
    assert.equal(retryDelayMinutes(1), 5);
    assert.equal(retryDelayMinutes(2), 10);
    assert.equal(retryDelayMinutes(3), 20);
    assert.equal(retryDelayMinutes(20), 360);
  });

  test('enqueueing the same draft twice stores one row', async () => {
    const db = createFakePrisma();
    assert.equal(await enqueueNotifications([draft()], NOW, db), 1);
    assert.equal(await enqueueNotifications([draft()], NOW, db), 0);
    assert.equal(outbox(db).length, 1);
    assert.equal(outbox(db)[0].status, 'PENDING');
  });

  test('a due row is sent once and marked SENT', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    const sent = [];

    const summary = await processOutbox({
      now: NOW,
      client: db,
      configured: true,
      send: async (message) => sent.push(message),
    });

    assert.deepEqual(summary, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'citizen@example.com');
    assert.equal(outbox(db)[0].status, 'SENT');
    assert.equal(outbox(db)[0].sentAt instanceof Date, true);
  });

  test('a failed send returns to PENDING with backoff, then succeeds later', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);

    const failed = await processOutbox({
      now: NOW,
      client: db,
      configured: true,
      send: async () => { throw new Error('provider down'); },
    });
    assert.deepEqual(failed, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
    assert.equal(outbox(db)[0].status, 'PENDING');
    assert.equal(outbox(db)[0].attempts, 1);
    assert.equal(outbox(db)[0].nextAttemptAt.getTime(), NOW.getTime() + 5 * MINUTE);
    assert.equal(outbox(db)[0].lastError, 'provider down');

    const tooEarly = await processOutbox({ now: new Date(NOW.getTime() + MINUTE), client: db, configured: true, send: async () => {} });
    assert.deepEqual(tooEarly, { claimed: 0, sent: 0, failed: 0, skipped: 0 });

    const later = await processOutbox({ now: new Date(NOW.getTime() + 6 * MINUTE), client: db, configured: true, send: async () => {} });
    assert.deepEqual(later, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
    assert.equal(outbox(db)[0].status, 'SENT');
  });

  test('the fifth failure is terminal', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    db.tables.notificationOutbox[0].attempts = 4;

    const summary = await processOutbox({
      now: NOW,
      client: db,
      configured: true,
      send: async () => { throw new Error('still down'); },
    });

    assert.deepEqual(summary, { claimed: 1, sent: 0, failed: 1, skipped: 0 });
    assert.equal(outbox(db)[0].status, 'FAILED');
    assert.equal(outbox(db)[0].attempts, 5);
  });

  test('unconfigured email is recorded as SKIPPED, not retried', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    let calls = 0;

    const summary = await processOutbox({
      now: NOW,
      client: db,
      configured: false,
      send: async () => { calls += 1; },
    });

    assert.deepEqual(summary, { claimed: 1, sent: 0, failed: 0, skipped: 1 });
    assert.equal(calls, 0);
    assert.equal(outbox(db)[0].status, 'SKIPPED');
    assert.match(outbox(db)[0].lastError, /not configured/);
  });

  test('a SENDING row whose lease expired is reclaimed', async () => {
    const db = createFakePrisma();
    await enqueueNotifications([draft()], NOW, db);
    db.tables.notificationOutbox[0].status = 'SENDING';
    db.tables.notificationOutbox[0].nextAttemptAt = new Date(NOW.getTime() - MINUTE);

    const summary = await processOutbox({ now: NOW, client: db, configured: true, send: async () => {} });
    assert.deepEqual(summary, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
  });

  test('the tick enqueues an overdue report and emails the owner and admins', async () => {
    const db = createFakePrisma();
    const owner = db.add('user', { email: 'citizen@example.com', password: 'x', firstName: 'Thandi', lastName: 'M', isVerified: true });
    const adminA = db.add('user', { email: 'admin.a@example.com', password: 'x', firstName: 'Ayanda', lastName: 'A', role: 'MUNICIPAL_ADMIN' });
    db.add('user', { email: 'super@example.com', password: 'x', firstName: 'Sipho', lastName: 'S', role: 'SUPER_ADMIN', isActive: false });
    db.add('report', {
      title: 'Burst pipe',
      description: 'Water is flooding the street.',
      category: 'WATER_LEAK',
      municipality: 'City of Tshwane',
      userId: owner.id,
      status: 'PENDING',
      createdAt: new Date(NOW.getTime() - 2 * 24 * 60 * MINUTE),
      responseDueAt: new Date(NOW.getTime() - 60 * MINUTE),
      resolutionDueAt: new Date(NOW.getTime() + 24 * 60 * MINUTE),
      slaCycleStartedAt: new Date(NOW.getTime() - 2 * 24 * 60 * MINUTE),
    });

    const sent = [];
    const summary = await runTick({
      now: NOW,
      client: db,
      configured: true,
      send: async (message) => sent.push(message),
      clientUrl: 'https://client.example.test',
    });

    assert.equal(summary.enqueued, 2);
    assert.equal(summary.sent, 2);
    assert.deepEqual(sent.map((message) => message.to).sort(), ['admin.a@example.com', 'citizen@example.com']);
    assert.ok(sent.every((message) => message.subject.startsWith('Report #1') || message.subject.startsWith('SLA breach')));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test tests/outbox.test.js`
Expected: FAIL with `Cannot find module '../src/services/notification.service'`.

- [ ] **Step 3: Add the notification email**

In `server/src/services/email.service.js`, add below the existing constants:

```js
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));

const isEmailConfigured = () => Boolean(resend);
```

Add before `module.exports`:

```js
const sendNotificationEmail = async ({ to, subject, text }) => {
  if (!resend) throw new Error('Email delivery is not configured.');

  const paragraphs = String(text)
    .split(/\n\n+/)
    .map((paragraph) => `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
          <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
              <tr>
                <td style="background:#0d3b5c;padding:28px 32px;">
                  <p style="margin:0;color:#e8b923;font-size:22px;font-weight:700;letter-spacing:-0.5px;">MuniSolve ZA</p>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">Civic Infrastructure Platform</p>
                </td>
              </tr>
              <tr><td style="padding:36px 32px 28px;">${paragraphs}</td></tr>
              <tr>
                <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;color:#94a3b8;font-size:12px;">&copy; 2026 MuniSolve ZA &mdash; K-ONE IT Solutions &middot; Johannesburg, SA</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) {
    logger.error({ err: error }, 'Notification email failed');
    throw new Error('Failed to send notification email.');
  }
};

module.exports = { sendVerificationEmail, sendNotificationEmail, isEmailConfigured };
```

Delete the previous `module.exports = { sendVerificationEmail };` line.

- [ ] **Step 4: Implement the outbox service**

Create `server/src/services/notification.service.ts`:

```ts
import prisma from '../config/db.config';
import { logger } from '../logger';
import { addMinutes } from '../domain/sla';
import type { NotificationDraft } from '../domain/sla';
import { planDueNotifications } from './sla.service';
import { isEmailConfigured, sendNotificationEmail } from './email.service';

export const OUTBOX_BATCH_SIZE = 25;
export const LEASE_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

export interface SendEmail {
  (message: { to: string; subject: string; text: string }): Promise<void>;
}

export interface TickOptions {
  now?: Date;
  limit?: number;
  client?: any;
  send?: SendEmail;
  configured?: boolean;
  clientUrl?: string;
}

export interface TickSummary {
  enqueued: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface ProcessSummary {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface ProcessOptions {
  now: Date;
  limit?: number;
  client?: any;
  send?: SendEmail;
  configured?: boolean;
}

export function retryDelayMinutes(attempts: number): number {
  return Math.min(5 * 2 ** Math.max(attempts - 1, 0), 6 * 60);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

export async function enqueueNotifications(
  drafts: NotificationDraft[],
  now: Date,
  client: any = prisma,
): Promise<number> {
  if (drafts.length === 0) return 0;
  const result = await client.notificationOutbox.createMany({
    data: drafts.map((draft) => ({
      ...draft,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextAttemptAt: now,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function processOutbox({
  now,
  limit = OUTBOX_BATCH_SIZE,
  client = prisma,
  send = sendNotificationEmail,
  configured = isEmailConfigured(),
}: ProcessOptions): Promise<ProcessSummary> {
  const rows = await client.notificationOutbox.findMany({
    where: {
      OR: [{ status: 'PENDING' }, { status: 'SENDING' }],
      nextAttemptAt: { lte: now },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
  });

  const summary: ProcessSummary = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    const claim = await client.notificationOutbox.updateMany({
      where: { id: row.id, status: row.status, nextAttemptAt: { lte: now } },
      data: { status: 'SENDING', nextAttemptAt: addMinutes(now, LEASE_MINUTES) },
    });
    if (claim.count !== 1) continue;
    summary.claimed += 1;

    if (!configured) {
      await client.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SKIPPED', lastError: 'Email delivery is not configured.' },
      });
      summary.skipped += 1;
      continue;
    }

    try {
      await send({ to: row.recipientEmail, subject: row.subject, text: row.body });
      await client.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: now, lastError: null },
      });
      summary.sent += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= row.maxAttempts;
      await client.notificationOutbox.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          lastError: errorMessage(error),
          nextAttemptAt: addMinutes(now, retryDelayMinutes(attempts)),
        },
      });
      summary.failed += 1;
      logger.warn({ notificationId: row.id, attempts, exhausted }, 'Notification delivery failed');
    }
  }

  return summary;
}

export async function runTick(options: TickOptions = {}): Promise<TickSummary> {
  const now = options.now ?? new Date();
  const client = options.client ?? prisma;

  const drafts = await planDueNotifications({ now, client, clientUrl: options.clientUrl });
  const enqueued = await enqueueNotifications(drafts, now, client);
  const processed = await processOutbox({
    now,
    client,
    limit: options.limit,
    send: options.send,
    configured: options.configured,
  });

  return { enqueued, ...processed };
}
```

`planDueNotifications` does not exist yet; Task 5 adds it. To keep this task independent, temporarily define a minimal `planDueNotifications` in `sla.service.ts` now (Task 5 replaces it with the query version). Add `server/src/services/sla.service.ts` in this step containing only:

```ts
import prisma from '../config/db.config';
import { planSlaNotifications } from '../domain/sla';
import type { NotificationDraft } from '../domain/sla';

export async function planDueNotifications(options: {
  now: Date;
  client?: any;
  clientUrl?: string;
}): Promise<NotificationDraft[]> {
  const client = options.client ?? prisma;
  const [reports, admins] = await Promise.all([
    client.report.findMany({
      where: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
      include: { user: { select: { email: true, firstName: true } } },
      orderBy: { resolutionDueAt: 'asc' },
      take: 500,
    }),
    client.user.findMany({
      where: { role: { in: ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { email: true, firstName: true },
    }),
  ]);

  return planSlaNotifications({
    now: options.now,
    reports,
    admins,
    clientUrl: options.clientUrl ?? process.env.CLIENT_URL ?? '',
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test tests/outbox.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/services/email.service.js src/services/notification.service.ts src/services/sla.service.ts tests/outbox.test.js
git commit -m "feat(sla): add notification outbox with retries"
```

---

### Task 5: Set and reset report SLA windows

**Files:**
- Modify: `server/src/services/sla.service.ts`
- Modify: `server/src/controllers/report.controller.js`
- Modify: `server/src/services/report.service.ts`
- Modify: `server/tests/transitions.test.js`
- Test: `server/tests/slaReports.test.js`

**Interfaces:**
- Produces: `loadSlaPolicy(category, client?)`, `windowsFromPolicy(policy, now)`, `slaWindowsForNewReport(category, now?, client?)`, `resetResolutionWindow(category, now, client)`, type `SlaWindows`.
- Consumes: `DEFAULT_SLA_POLICY`, `addMinutes` from the domain module.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/slaReports.test.js`:

```js
'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('report SLA windows', () => {
  let h;
  let citizen;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => {
    h.reset();
    citizen = h.makeUser({ email: 'citizen@example.com' });
  });

  test('a new report receives the default windows when no policy row exists', async () => {
    const beforeRequest = Date.now();
    const res = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Pothole on the test road',
        description: 'A synthetic report used to check SLA windows.',
        category: 'POTHOLE',
        municipality: 'City of Johannesburg',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.responseDueAt);
    assert.ok(res.body.data.resolutionDueAt);
    assert.ok(res.body.data.slaCycleStartedAt);
    assert.ok(new Date(res.body.data.responseDueAt).getTime() >= beforeRequest + 72 * HOUR - 5000);
    assert.ok(new Date(res.body.data.resolutionDueAt).getTime() >= beforeRequest + 14 * DAY - 5000);
  });

  test('a configured policy row overrides the default', async () => {
    h.db.add('slaPolicy', { category: 'WATER_LEAK', responseMinutes: 60, resolutionMinutes: 240 });

    const beforeRequest = Date.now();
    const res = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Burst pipe on the test road',
        description: 'A synthetic water leak used to check the policy lookup.',
        category: 'WATER_LEAK',
        municipality: 'City of Tshwane',
      },
    });

    assert.equal(res.status, 201);
    const responseDue = new Date(res.body.data.responseDueAt).getTime();
    assert.ok(responseDue >= beforeRequest + HOUR - 5000);
    assert.ok(responseDue <= beforeRequest + HOUR + 5000);
  });

  test('an inactive policy falls back to the default', async () => {
    h.db.add('slaPolicy', { category: 'POTHOLE', responseMinutes: 1, resolutionMinutes: 1, isActive: false });

    const res = await h.api('POST', '/api/reports', {
      token: h.tokenFor(citizen),
      body: {
        title: 'Pothole on another test road',
        description: 'A synthetic report used to check the inactive policy fallback.',
        category: 'POTHOLE',
        municipality: 'City of Johannesburg',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(new Date(res.body.data.responseDueAt).getTime() > Date.now() + 71 * HOUR);
  });
});
```

In `server/tests/transitions.test.js`, add this test after the existing reopen test:

```js
  test('a reopen resets the resolution window and starts a new SLA cycle', async () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const report = h.makeReport(citizen, {
      status: 'RESOLVED',
      resolutionDueAt: longAgo,
      slaCycleStartedAt: longAgo,
    });

    const res = await h.api('PATCH', `/api/admin/reports/${report.id}/status`, {
      token: as(admin),
      body: { status: 'IN_PROGRESS' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.reopenCount, 1);
    assert.ok(new Date(res.body.data.resolutionDueAt).getTime() > Date.now() + 13 * 24 * 60 * 60 * 1000);
    assert.ok(new Date(res.body.data.slaCycleStartedAt).getTime() > Date.now() - 60 * 1000);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test tests/slaReports.test.js tests/transitions.test.js`
Expected: FAIL because `responseDueAt` is null and the reopen test's new fields stay at their old values.

- [ ] **Step 3: Add the policy queries to the SLA service**

Replace `server/src/services/sla.service.ts` with:

```ts
import prisma from '../config/db.config';
import { DEFAULT_SLA_POLICY, addMinutes, planSlaNotifications, OPEN_REPORT_STATUSES } from '../domain/sla';
import type { NotificationDraft, SlaPolicyValues } from '../domain/sla';

export interface SlaWindows {
  responseDueAt: Date;
  resolutionDueAt: Date;
  slaCycleStartedAt: Date;
}

export async function loadSlaPolicy(category: string, client: any = prisma): Promise<SlaPolicyValues> {
  const policy = await client.slaPolicy.findUnique({ where: { category } });
  if (!policy || policy.isActive === false) return DEFAULT_SLA_POLICY;
  return {
    responseMinutes: policy.responseMinutes,
    resolutionMinutes: policy.resolutionMinutes,
  };
}

export function windowsFromPolicy(policy: SlaPolicyValues, now: Date): SlaWindows {
  return {
    responseDueAt: addMinutes(now, policy.responseMinutes),
    resolutionDueAt: addMinutes(now, policy.resolutionMinutes),
    slaCycleStartedAt: now,
  };
}

export async function slaWindowsForNewReport(
  category: string,
  now: Date = new Date(),
  client: any = prisma,
): Promise<SlaWindows> {
  return windowsFromPolicy(await loadSlaPolicy(category, client), now);
}

export async function resetResolutionWindow(
  category: string,
  now: Date,
  client: any = prisma,
): Promise<{ resolutionDueAt: Date; slaCycleStartedAt: Date }> {
  const policy = await loadSlaPolicy(category, client);
  return {
    resolutionDueAt: addMinutes(now, policy.resolutionMinutes),
    slaCycleStartedAt: now,
  };
}

export async function planDueNotifications(options: {
  now: Date;
  client?: any;
  clientUrl?: string;
}): Promise<NotificationDraft[]> {
  const client = options.client ?? prisma;
  const [reports, admins] = await Promise.all([
    client.report.findMany({
      where: { status: { in: [...OPEN_REPORT_STATUSES] } },
      include: { user: { select: { email: true, firstName: true } } },
      orderBy: { resolutionDueAt: 'asc' },
      take: 500,
    }),
    client.user.findMany({
      where: { role: { in: ['MUNICIPAL_ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { email: true, firstName: true },
    }),
  ]);

  return planSlaNotifications({
    now: options.now,
    reports,
    admins,
    clientUrl: options.clientUrl ?? process.env.CLIENT_URL ?? '',
  });
}
```

- [ ] **Step 4: Set windows when a report is created**

In `server/src/controllers/report.controller.js`, add the import near the other service imports:

```js
const { slaWindowsForNewReport } = require('../services/sla.service');
```

Replace the `const report = await prisma.report.create({` block's `data` with:

```js
  const slaWindows = await slaWindowsForNewReport(category);

  const report = await prisma.report.create({
    data: {
      title,
      description,
      category,
      municipality,
      ...(address !== undefined && { address }),
      ...(latitude !== undefined && { latitude }),
      ...(longitude !== undefined && { longitude }),
      ...(weatherData && {
        weatherTemp: weatherData.weatherTemp,
        weatherCondition: weatherData.weatherCondition,
        weatherRainfall: weatherData.weatherRainfall,
        weatherWind: weatherData.weatherWind,
        weatherHumidity: weatherData.weatherHumidity,
      }),
      status: 'PENDING',
      userId,
      ...slaWindows,
    },
```

- [ ] **Step 5: Reset the resolution window on reopen**

In `server/src/services/report.service.ts`, add the import:

```ts
import { resetResolutionWindow } from './sla.service';
```

Replace the reopen branch:

```ts
    if (
      (options.nextStatus === 'PENDING' || options.nextStatus === 'IN_PROGRESS') &&
      REOPEN_SOURCES.includes(report.status)
    ) {
      data.reopenCount = { increment: 1 };
    }
```

with:

```ts
    if (
      (options.nextStatus === 'PENDING' || options.nextStatus === 'IN_PROGRESS') &&
      REOPEN_SOURCES.includes(report.status)
    ) {
      const windows = await resetResolutionWindow(report.category, new Date(), tx);
      data.reopenCount = { increment: 1 };
      data.resolutionDueAt = windows.resolutionDueAt;
      data.slaCycleStartedAt = windows.slaCycleStartedAt;
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --import tsx --test tests/slaReports.test.js tests/transitions.test.js`
Expected: PASS.

- [ ] **Step 7: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/sla.service.ts src/controllers/report.controller.js src/services/report.service.ts tests/slaReports.test.js tests/transitions.test.js
git commit -m "feat(sla): stamp and reset report SLA windows"
```

---

### Task 6: Authenticated tick endpoint

**Files:**
- Create: `server/src/controllers/tick.controller.ts`
- Create: `server/src/routes/internal.routes.js`
- Modify: `server/src/server.js`
- Modify: `server/tests/helpers/harness.js`
- Test: `server/tests/tick.test.js`

**Interfaces:**
- Consumes: `runTick` from `src/services/notification.service.ts`.
- Produces: `POST /api/internal/tick`, header `x-tick-secret`, response `{ success, message, data: { enqueued, claimed, sent, failed, skipped } }`.
- Produces: harness field `tickSecret` and `notifications` array; the email stub answers `isEmailConfigured() === true`.

- [ ] **Step 1: Extend the harness**

In `server/tests/helpers/harness.js`, add a constant beside the other test credentials:

```js
const TEST_TICK_SECRET = crypto.randomBytes(16).toString('hex');
```

In `startApp`, set the variable after `process.env.JWT_SECRET`:

```js
  process.env.TICK_SECRET = TEST_TICK_SECRET;
```

Change the email stub:

```js
  const email = { sent: [], notifications: [] };
  stubModule(appPath('src/services/email.service.js'), {
    sendVerificationEmail: async (...args) => {
      email.sent.push(args);
    },
    sendNotificationEmail: async (message) => {
      email.notifications.push(message);
    },
    isEmailConfigured: () => true,
  });
```

In `reset`, clear the new array:

```js
    email.notifications.length = 0;
```

In the returned object, add:

```js
    notifications: email.notifications,
    tickSecret: TEST_TICK_SECRET,
```

- [ ] **Step 2: Write the failing tests**

Create `server/tests/tick.test.js`:

```js
'use strict';

const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers/harness');

const DAY = 24 * 60 * 60 * 1000;

describe('internal tick endpoint', () => {
  let h;

  before(async () => { h = await startApp(); });
  after(() => h.close());
  beforeEach(() => h.reset());

  test('rejects a missing or wrong secret', async () => {
    const missing = await h.api('POST', '/api/internal/tick');
    assert.equal(missing.status, 401);
    assert.equal(missing.body.errorCode, 'UNAUTHORIZED');

    const wrong = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': 'not-the-secret' } });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.errorCode, 'UNAUTHORIZED');
  });

  test('returns 503 when no secret is configured', async () => {
    const saved = process.env.TICK_SECRET;
    delete process.env.TICK_SECRET;
    try {
      const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': '' } });
      assert.equal(res.status, 503);
      assert.equal(res.body.errorCode, 'TICK_NOT_CONFIGURED');
    } finally {
      process.env.TICK_SECRET = saved;
    }
  });

  test('runs with the correct secret and returns counts only', async () => {
    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, { enqueued: 0, claimed: 0, sent: 0, failed: 0, skipped: 0 });
    assert.equal(JSON.stringify(res.body).includes(h.tickSecret), false);
  });

  test('enqueues and emails an overdue report', async () => {
    const owner = h.makeUser({ email: 'citizen@example.com' });
    h.makeUser({ email: 'admin@example.com', role: 'MUNICIPAL_ADMIN' });
    const now = Date.now();
    h.makeReport(owner, {
      status: 'PENDING',
      createdAt: new Date(now - 2 * DAY),
      responseDueAt: new Date(now - 60 * 60 * 1000),
      resolutionDueAt: new Date(now + DAY),
      slaCycleStartedAt: new Date(now - 2 * DAY),
    });

    const res = await h.api('POST', '/api/internal/tick', { headers: { 'x-tick-secret': h.tickSecret } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.enqueued, 2);
    assert.equal(res.body.data.sent, 2);
    assert.deepEqual(h.notifications.map((message) => message.to).sort(), ['admin@example.com', 'citizen@example.com']);
    assert.equal(h.db.tables.notificationOutbox.length, 2);
    assert.ok(h.db.tables.notificationOutbox.every((row) => row.status === 'SENT'));
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --import tsx --test tests/tick.test.js`
Expected: FAIL with 404 because the route does not exist.

- [ ] **Step 4: Implement the controller and route**

Create `server/src/controllers/tick.controller.ts`:

```ts
import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import { runTick } from '../services/notification.service';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const tick: RequestHandler = async (req, res) => {
  const expected = process.env.TICK_SECRET;
  if (!expected) {
    throw new AppError(503, 'TICK_NOT_CONFIGURED', 'Scheduled jobs are not configured.');
  }

  const provided = req.get('x-tick-secret') ?? '';
  if (!safeEqual(provided, expected)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid tick secret.');
  }

  const data = await runTick({ now: new Date() });
  res.status(200).json({ success: true, message: 'Tick complete', data });
};
```

Create `server/src/routes/internal.routes.js`:

```js
const express = require('express');
const { generalLimiter } = require('../middleware/rateLimit.middleware');
const { tick } = require('../controllers/tick.controller');

const router = express.Router();

// This router is mounted before the global /api limiter so its own limiter is the only one that runs.
router.post('/tick', generalLimiter, tick);

module.exports = router;
```

In `server/src/server.js`, add both lines immediately after the readiness route and before the global limiter, because the internal router carries its own:

```js
const internalRoutes = require('./routes/internal.routes');

// The internal router has its own limiter, so it is mounted before the global one.
app.use('/api/internal', internalRoutes);
```

Leave the other route requires and mounts where they are.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test tests/tick.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/controllers/tick.controller.ts src/routes/internal.routes.js src/server.js tests/helpers/harness.js tests/tick.test.js
git commit -m "feat(sla): add the authenticated tick endpoint"
```

---

### Task 7: Demo verification, scheduler workflow and documentation

**Files:**
- Modify: `server/scripts/demo.js`
- Modify: `server/scripts/verify-workflow.js`
- Modify: `server/prisma/seedDemo.js`
- Create: `.github/workflows/sla-tick.yml`
- Modify: `render.yaml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `POST /api/internal/tick`.
- Produces: a demo that proves tick authentication with real HTTP and PostgreSQL; an hourly GitHub Actions schedule.

- [ ] **Step 1: Set due dates in the demo seed**

In `server/prisma/seedDemo.js`, require the SLA service lazily inside `ensureReports`, after the local-only safety check has run:

```js
async function ensureReports(prisma, users, teams) {
  const { slaWindowsForNewReport } = require('../src/services/sla.service');
  for (const r of DEMO_REPORTS) {
    const { owner, team, ...fields } = r;
    const userId = users[owner].id;
    const assignment = team
      ? { assignedTeamId: teams[team].id, assignedAt: new Date() }
      : { assignedTeamId: null, assignedAt: null };
    const windows = await slaWindowsForNewReport(r.category, new Date(), prisma);

    const existing = await prisma.report.findFirst({ where: { userId, title: r.title } });
    if (existing) {
      await prisma.report.update({ where: { id: existing.id }, data: { ...fields, ...assignment, ...windows } });
    } else {
      await prisma.report.create({ data: { ...fields, ...assignment, ...windows, userId } });
    }
  }
}
```

- [ ] **Step 2: Give the demo a tick secret and verify the endpoint**

In `server/scripts/demo.js`, add to the `env` object:

```js
  TICK_SECRET: randomBytes(16).toString('hex'),
```

Change the verification call to pass the secret, because it lives in the child environment, not in the parent process:

```js
    await verifyWorkflow(baseURL, env.DEMO_PASSWORD, env.TICK_SECRET);
```

In `server/scripts/verify-workflow.js`, change the function signature and widen the request helper to accept headers:

```js
async function verifyWorkflow(baseURL, password, tickSecret) {
```

```js
  async function request(label, method, route, status, token, body, extraHeaders = {}) {
    const response = await fetch(baseURL + route, {
      method, signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...extraHeaders },
      ...(body && { body: JSON.stringify(body) }),
    });
```

After the admin dashboard assertion, before the final `console.log`, add:

```js
  await request('Tick rejects an anonymous call', 'POST', '/internal/tick', 401);
  const tick = await request('Tick runs with the scheduler secret', 'POST', '/internal/tick', 200, null, undefined, {
    'x-tick-secret': tickSecret,
  });
  assert.equal(tick.data.enqueued, 0);
  assert.equal(tick.data.sent, 0);
```

- [ ] **Step 3: Add the hourly workflow**

Create `.github/workflows/sla-tick.yml`:

```yaml
name: SLA tick

on:
  schedule:
    - cron: '5 * * * *'
  workflow_dispatch:

permissions: {}

concurrency:
  group: sla-tick
  cancel-in-progress: false

jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - name: Call the tick endpoint
        env:
          API_URL: ${{ secrets.MUNISOLVE_API_URL }}
          TICK_SECRET: ${{ secrets.TICK_SECRET }}
        run: |
          if [ -z "$API_URL" ] || [ -z "$TICK_SECRET" ]; then
            echo "::error::MUNISOLVE_API_URL and TICK_SECRET repository secrets are required."
            exit 1
          fi
          curl --fail-with-body --silent --show-error --retry 2 --retry-delay 5 \
            --max-time 180 -X POST "${API_URL%/}/api/internal/tick" \
            -H "x-tick-secret: $TICK_SECRET"
```

- [ ] **Step 4: Declare the variable in the Render blueprint**

In `render.yaml`, add under `envVars` after `NODE_ENV`:

```yaml
      - key: TICK_SECRET
        sync: false
```

- [ ] **Step 5: Document the scheduler**

In `README.md`, add a section after the API contracts section:

```markdown
## Scheduled SLA checks

Reports carry a response target and a resolution target chosen by category. A tick finds reports approaching (80% of the window) or past those targets, writes one notification per report, cycle and recipient to the `NotificationOutbox` table, and emails through Resend with bounded retries.

The tick is `POST /api/internal/tick` and requires the `x-tick-secret` header. `.github/workflows/sla-tick.yml` calls it hourly (`5 * * * *`). Hourly is deliberate: a five-minute tick would wake Neon's free compute continuously and exceed the monthly allowance. Detection is therefore up to one hour late, which is acceptable for targets measured in hours and days. GitHub disables scheduled workflows after 60 days without repository activity; use manual dispatch if that happens.

Repository secrets required by the workflow:

- `MUNISOLVE_API_URL` — the API origin, without a trailing slash.
- `TICK_SECRET` — the same random value set on the Render service.

Email delivery uses `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Without them the outbox marks rows `SKIPPED` instead of retrying forever. Policies are seeded in the migration; changing a target is a new migration.
```

- [ ] **Step 6: Run the full local verification**

Run from `server/`:

```bash
npm test
npm run typecheck
npm run build
npm run demo:verify
```

Expected: all tests pass, the disposable PostgreSQL demo applies migrations with no drift, the workflow verification prints `"result": "passed"`, and the tick checks pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/demo.js scripts/verify-workflow.js prisma/seedDemo.js .github/workflows/sla-tick.yml render.yaml README.md
git commit -m "chore(sla): schedule the hourly tick and document it"
```

---

### Task 8: Publish, configure and verify production

**Files:** none. This task changes GitHub and Render state.

- [ ] **Step 1: Push and open the pull request**

```bash
git push -u origin phase-2a-sla-outbox
gh pr create --title "Phase 2A: SLA policies and notification outbox" --body "$(cat <<'EOF'
## Summary
- per-category response and resolution targets, stamped at report creation and reset on reopen
- a pure planner plus a PostgreSQL notification outbox with dedupe, leases and retries
- an authenticated hourly tick called from GitHub Actions
- Resend notification email with escaped user content

## Test plan
- [x] unit and HTTP tests, typecheck and build
- [x] disposable PostgreSQL workflow verification with migration drift check
- [ ] CI checks and production tick
EOF
)"
```

- [ ] **Step 2: Wait for CI**

Run: `gh pr checks --watch --interval 15`
Expected: every check passes, including `postgres-workflow` and CodeQL. If CodeQL flags the new route for missing rate limiting, confirm the global `/api/` limiter covers it; add the limiter explicitly on the route only if the alert persists.

- [ ] **Step 3: Merge and let Render deploy**

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

Render auto-deploys `main` and runs `prisma migrate deploy` before starting. Wait for the deploy to report `live`, then check:

```bash
curl -s https://munisolve-za-1.onrender.com/ready
```

Expected: `database: "up"`, `migrations: "current"`.

- [ ] **Step 4: Generate and install the tick secret**

Never print the value. Run from the repository root:

```bash
TICK="$(openssl rand -hex 32)"
RENDER_KEY="$(sed -n 's/^RENDER_API_KEY=//p' /c/Users/Konet/.qoder/secrets/render.env)"
curl -sS -X PUT "https://api.render.com/v1/services/srv-d6agchjh46gs738dve9g/env-vars/TICK_SECRET" \
  -H "Authorization: Bearer $RENDER_KEY" -H "content-type: application/json" \
  --data "{\"value\":\"$TICK\"}" > /dev/null
gh secret set TICK_SECRET --body "$TICK"
gh secret set MUNISOLVE_API_URL --body "https://munisolve-za-1.onrender.com"
unset TICK
```

A new Render env var triggers a restart. Wait for the service to come back.

- [ ] **Step 5: Trigger and inspect a real tick**

```bash
gh workflow run sla-tick.yml
sleep 360
gh run list --workflow sla-tick.yml --limit 3
```

If the cold start takes longer than the first attempt, re-run. Then check the run log; it must show the JSON counts, and the response must not contain the secret. Optionally call the endpoint manually with the secret read from the file without printing it.

- [ ] **Step 6: Record the outcome**

Create `.superpowers/sdd/2026-11-02-phase-2a-sla-outbox/progress.md` (run the workspace helper so the directory exists) and record: merge commit, Render deploy id, `/ready` result, workflow run id and tick counts.
