# MuniSolve ZA Phase 2A: SLA Policies and Notification Outbox

**Date:** 2026-11-02
**Owner:** Kone Tshivhinda
**Status:** Approved direction, ready for implementation planning
**Depends on:** [Phase 1: Trustworthy Core](2026-11-02-phase-1-trustworthy-core-design.md)

## Context

Phase 1 gave the platform validated input, one report state machine, versioned migrations, honest health checks and correlated logs. Reports now move through `PENDING → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`, but nothing watches the clock. A report can sit untouched for months and no one is told.

Phase 2A adds the first automation: per-category service targets, a scheduled tick that finds reports approaching or past those targets, and a durable notification outbox that sends email through Resend with retries. It is the foundation Phase 2B (duplicate detection and auto-assignment) will reuse for its own notifications.

The work must fit R0: Render free, Neon free, Vercel Hobby, Resend free. That constraint drives the two decisions below.

## Goals

1. Every report gets a response target and a resolution target at creation, chosen by category.
2. A scheduled tick finds warnings and breaches once per hour and records them in a durable outbox.
3. The outbox sends email at most once per notification, survives failures with bounded retries, and never loses a notification because a request failed.
4. Citizens are told when their report is close to its target or overdue; municipal admins are told when a report breaches.
5. Existing API paths, success payloads, state transitions and demo flows keep working.
6. New code is TypeScript. Existing JavaScript files change only where this phase needs them.

## Non-goals

- No duplicate detection, auto-assignment or priority scoring. Those are Phase 2B.
- No in-app notification centre or frontend changes. Phase 2A sends email only.
- No admin UI or API to edit policies. Defaults ship in a migration; changing them is a migration until a later phase.
- No WhatsApp, SMS or push channel.
- No Redis, queue or paid cron service.
- No business-day calendars. Targets are calendar hours, stated as such in the email.
- No change to JWT claims, roles, CORS, ownership-as-404 semantics or the state machine's allowed moves.

## The R0 scheduling decision

Two free-tier limits decide the execution model:

- **Render free** stops a web service after 15 minutes without traffic, so an in-process timer does not run reliably.
- **Neon free** grants about 191.9 compute hours per month and suspends compute after a few idle minutes. Any tick that queries PostgreSQL wakes it.

A five-minute tick would query Neon every five minutes, keep compute awake around the clock and exceed the monthly budget. The tick therefore runs **hourly** from a GitHub Actions schedule (`5 * * * *`, free for this public repository). At the default five-minute Neon idle timeout that costs roughly two compute hours per day, about 60 per month, leaving the rest for real traffic. SLA targets are measured in hours and days, so one hour of detection latency is acceptable and is documented.

The tick is an HTTP endpoint rather than a Render cron job because Render cron jobs require a paid instance type. The endpoint is idempotent, so a delayed, duplicated or manually dispatched run is safe.

## Architecture

```
GitHub Actions (hourly)
        │  POST /api/internal/tick   x-tick-secret
        ▼
tick.controller.ts
        │
        ├── sla.service.ts        plan due warnings/breaches (pure domain + queries)
        │        └── domain/sla.ts   no Prisma, no clock
        │
        └── notification.service.ts
                 ├── enqueue (dedupeKey unique, createMany skipDuplicates)
                 └── process (claim → send → mark; retry with backoff)
                          └── email.service.js  sendNotificationEmail
```

- The planner is a pure module. It receives `now`, reports, admins and the client URL, and returns notification drafts. Tests need no database or clock.
- The outbox is a PostgreSQL table. It is the only stateful dependency; no Redis or queue.
- The tick endpoint is authenticated with a shared secret and returns counts only.
- Email delivery is injected for tests and skipped honestly when Resend is not configured.

## Data model

Three additions to `server/prisma/schema.prisma`:

### `SlaPolicy`

| Field | Type | Notes |
|---|---|---|
| `id` | Int, autoincrement | |
| `category` | String, unique | Matches `CATEGORIES` in `server/src/schemas/common.ts` |
| `responseMinutes` | Int | Time allowed to reach `ASSIGNED` |
| `resolutionMinutes` | Int | Time allowed to reach `RESOLVED` |
| `isActive` | Boolean, default true | An inactive row falls back to the default policy |
| `createdAt`, `updatedAt` | DateTime | |

Default policies, seeded by the migration with `ON CONFLICT (category) DO NOTHING`:

| Category | Response | Resolution |
|---|---|---|
| `ELECTRICITY_OUTAGE` | 2 h | 72 h |
| `WATER_LEAK` | 4 h | 72 h |
| `SEWAGE` | 8 h | 72 h |
| `TRAFFIC_LIGHT` | 8 h | 240 h (10 days) |
| `REFUSE_COLLECTION` | 24 h | 120 h (5 days) |
| `POTHOLE` | 48 h | 720 h (30 days) |
| `STREETLIGHT` | 48 h | 504 h (21 days) |
| `ILLEGAL_DUMPING` | 48 h | 168 h (7 days) |
| `GRAFFITI` | 72 h | 336 h (14 days) |
| `PARK_MAINTENANCE` | 72 h | 336 h (14 days) |
| `OTHER` | 72 h | 336 h (14 days) |

If a category has no active row at runtime, `DEFAULT_SLA_POLICY` is `{ responseMinutes: 4320, resolutionMinutes: 20160 }` (72 h and 14 days).

### `Report` additions

| Field | Type | Meaning |
|---|---|---|
| `responseDueAt` | DateTime? | When first assignment is due |
| `resolutionDueAt` | DateTime? | When resolution is due for the current cycle |
| `slaCycleStartedAt` | DateTime? | Start of the current resolution window |

At creation: `responseDueAt = now + responseMinutes`, `resolutionDueAt = now + resolutionMinutes`, `slaCycleStartedAt = now`.

On reopen (`RESOLVED`, `CLOSED` or `REJECTED` moving back to `PENDING` or `IN_PROGRESS`): `resolutionDueAt = now + resolutionMinutes`, `slaCycleStartedAt = now`. `responseDueAt` does not reset; first response either happened or it did not.

The migration backfills existing reports from `createdAt` using their category policy, defaulting unknown categories to `DEFAULT_SLA_POLICY`.

### `NotificationOutbox`

| Field | Type | Notes |
|---|---|---|
| `id` | Int, autoincrement | |
| `dedupeKey` | String, unique | One row per report, kind, cycle and recipient |
| `kind` | String | `SLA_RESPONSE_WARNING`, `SLA_RESPONSE_BREACH`, `SLA_RESOLUTION_WARNING`, `SLA_RESOLUTION_BREACH` |
| `reportId` | Int? | Cascade on report delete |
| `recipientEmail` | String | Snapshot at enqueue time |
| `subject`, `body` | String | `body` is plain text |
| `status` | String, default `PENDING` | `PENDING`, `SENDING`, `SENT`, `FAILED`, `SKIPPED` |
| `attempts` | Int, default 0 | |
| `maxAttempts` | Int, default 5 | |
| `nextAttemptAt` | DateTime, default now | Claim lease and retry time |
| `sentAt`, `lastError` | nullable | |
| `createdAt`, `updatedAt` | DateTime | |

Indexes: `(status, nextAttemptAt)` for the worker and `(reportId)` for lookups.

Dedupe key format: `sla:<KIND>:r<reportId>:c<reopenCount>:<recipientEmail>`. Reopening a report starts a new cycle, so it can warn again.

## Tick behaviour

`POST /api/internal/tick`, header `x-tick-secret`.

1. If `TICK_SECRET` is unset, return 503 `TICK_NOT_CONFIGURED`. If the header is missing or wrong, return 401 `UNAUTHORIZED`. Comparison is constant time.
2. **Plan.** Load open reports (`PENDING`, `ASSIGNED`, `IN_PROGRESS`, at most 500 ordered by `resolutionDueAt`) with owner email, and load active admins (`MUNICIPAL_ADMIN`, `SUPER_ADMIN`).
   - *Response warning*: status `PENDING`, never assigned, `now ≥ warningAt(responseDueAt, createdAt)` but before `responseDueAt`. Recipient: owner.
   - *Response breach*: same conditions, `now ≥ responseDueAt`. Recipients: owner and admins.
   - *Resolution warning*: not finished, `now ≥ warningAt(resolutionDueAt, slaCycleStartedAt)` but before `resolutionDueAt`. Recipient: owner.
   - *Resolution breach*: not finished, `now ≥ resolutionDueAt`. Recipients: owner and admins.
   - `warningAt(start, due) = start + 0.8 × (due − start)`.
3. **Enqueue.** `createMany({ data, skipDuplicates: true })`. The unique key makes a repeated or overlapping tick harmless.
4. **Process.** Select up to 25 rows whose status is `PENDING`, or `SENDING` with an expired lease, and whose `nextAttemptAt ≤ now`, oldest first.
   - Claim each row with a conditional `updateMany` that sets `SENDING` and a ten-minute lease. A lost claim skips the row.
   - If email is not configured, mark `SKIPPED` with `lastError = 'Email delivery is not configured.'` and do not retry.
   - Otherwise call `sendNotificationEmail`. Success marks `SENT` with `sentAt`. Failure increments `attempts`; below `maxAttempts` it returns to `PENDING` with `nextAttemptAt = now + min(5 min × 2^(attempts−1), 6 h)`, at `maxAttempts` it becomes `FAILED` with `lastError`.
   - One failed email never aborts the batch.
5. Respond `200` with `{ success, message, data: { enqueued, claimed, sent, failed, skipped } }`. No recipient addresses or secret values appear in the response or logs.

The lease protects against two overlapping ticks. If a process dies after claiming but before sending, the lease expires and a later tick retries, which can duplicate an email in that narrow window. The design accepts that risk; exactly-once delivery would need a provider idempotency key.

## Email

`server/src/services/email.service.js` gains:

- `isEmailConfigured()` — true when `RESEND_API_KEY` is set.
- `sendNotificationEmail({ to, subject, text })` — wraps the existing branded layout and throws when unconfigured.

`sendVerificationEmail` is unchanged.

## Report integration

- `report.controller.js` `createReport` computes due dates through `sla.service.ts` before `prisma.report.create`.
- `report.service.ts` `transitionReport` resets the resolution window inside the existing transaction when a report is reopened.
- `seedDemo.js` sets due dates for seeded reports so local demos show realistic targets.
- No response shape changes beyond the new report fields, which appear automatically.

## Environment and rollout

New variable: `TICK_SECRET`, at least 32 random bytes, set on Render and as a GitHub Actions secret. Two repository secrets are needed:

- `TICK_SECRET` — the shared secret.
- `MUNISOLVE_API_URL` — the API origin, for example `https://munisolve-za-1.onrender.com`.

The secret is generated during rollout, written only to Render and GitHub, and never committed.

`render.yaml` gains `TICK_SECRET` with `sync: false` so a blueprint-based deploy prompts for it. The live service is dashboard-managed, so rollout sets it through the Render API.

New workflow `.github/workflows/sla-tick.yml`:

- `schedule: cron '5 * * * *'` and `workflow_dispatch`.
- `permissions: {}` and a concurrency group that does not cancel a running tick.
- Calls the endpoint with `curl --fail-with-body --max-time 180`; the long timeout covers a Render free cold start.
- Fails loudly when either secret is missing.

## Testing

- Pure planner tests cover all four kinds, the 80% threshold, assigned reports skipping response kinds, finished reports being ignored, reopen cycles, and unique dedupe keys.
- Outbox tests with the fake Prisma cover enqueue deduplication, successful send, retry and backoff, max attempts, unconfigured email, and lease reclaim.
- Endpoint tests cover 503 when unset, 401 for a wrong or missing header, and 200 with counts for the correct secret.
- Report tests cover due dates at creation and `resolutionDueAt` reset on reopen.
- `fakePrisma.js` gains the two models, comparison operators (`lt`, `lte`, `gt`, `gte`), `notIn`, `OR`, `createMany` with `skipDuplicates`, and dedupe-key uniqueness.
- `demo:verify` asserts the tick rejects an unauthenticated call and accepts the authenticated one. The disposable PostgreSQL run also proves the migration matches the schema through the existing `migrate diff`.
- No test touches the network. Email is stubbed in the harness and injected in service tests.

## Risks

| Risk | Mitigation |
|---|---|
| GitHub schedules can be delayed or disabled after 60 days of inactivity | Manual dispatch exists; the tick is idempotent; the README documents the limit |
| Neon compute budget | Hourly cadence, batch cap of 25 emails, 500-report scan cap |
| Duplicate email after a crash between send and mark | Ten-minute lease keeps the window narrow; accepted for R0 |
| Resend free tier limits | Batches of 25; failures retry with backoff; outbox records what happened |
| Admin email volume on many breaches | Breaches are per report per cycle; admins are loaded once per tick |
