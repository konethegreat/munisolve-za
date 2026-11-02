# MuniSolve ZA Phase 1: Trustworthy Core

**Date:** 2026-11-02
**Owner:** Kone Tshivhinda
**Status:** Approved direction, ready for implementation planning

## Context

MuniSolve ZA is a South African civic-tech platform for reporting and resolving municipal infrastructure faults. It is a working portfolio project with a React 19 client, an Express 5 API, Prisma 6 and PostgreSQL on Neon, deployed on Vercel and Render.

The platform works, but it has accumulated first-generation gaps:

- No central error handler, no 404 handler and no request IDs.
- Validation exists only on register and login. Report, supervisor, admin and team routes are unvalidated.
- The unused validation rules expect UUID IDs, `municipalityId`, `wardId` and `imageUrls`, none of which match the database.
- Registration escapes names, so `O'Brien` is stored as an HTML entity.
- Report status and user role are free strings, and the workflow is duplicated across controllers. Admins can set any status.
- Production runs `prisma db push`. Migration history is not in sync with Neon.
- `/health` does not check the database.
- Logging is console based, without request correlation.
- Rate limiting is applied twice and uses in-memory stores.

This phase fixes those foundations. It deliberately does not add automation or change the interface. Every later phase depends on the contracts defined here.

## Overhaul roadmap

| Phase | Scope | Depends on |
|---|---|---|
| 1. Trustworthy core | Validation, state machine, errors, migrations, health, logging | Nothing |
| 2A. SLA and outbox | SLA policies, job tick, notification outbox, email | Phase 1 |
| 2B. Duplicates and assignment | Duplicate detection, auto-assignment, explainable decisions | Phase 1, 2A |
| 3. Integrations | Open-Meteo, Nominatim proxy, webhooks, OpenAPI, optional WhatsApp | Phase 1 |
| 4. Frontend overhaul | Typed client, TanStack Query, tokens, mobile supervisor, landing page | Phase 1, 3 |
| 5. TypeScript and hardening | Incremental TypeScript, Sentry, uptime, backups, release runbook | All phases |

## Goals

1. Every mutating endpoint validates input and returns a consistent, safe error envelope.
2. One report state machine enforces transitions and role permissions for citizens, supervisors and admins.
3. Schema changes ship through versioned Prisma migrations, with no `db push` in production or CI.
4. The API exposes honest liveness and readiness checks.
5. Logs correlate requests with a request ID and never contain secrets.
6. Existing API paths, success payloads and demo flows keep working.
7. New code is written in TypeScript from this phase onward, even while most existing files remain JavaScript.

## Non-goals

- No automation, SLA timers, duplicate detection or auto-assignment in this phase.
- No frontend redesign or new UI components in this phase.
- No full TypeScript rewrite.
- No multi-tenant enforcement, municipality table or ward model.
- No paid infrastructure. The design must fit R0: Render free, Neon free, Vercel Hobby, Resend free.
- No change to JWT claims, bcrypt rounds, OTP hashing, Google login behavior, CORS allowlist, `trust proxy` or ownership-as-404 semantics.

## Architecture principles

- PostgreSQL is the only stateful dependency. No Redis or queue is required in this phase.
- The existing response shape stays: `success`, `message`, optional `errorCode`, `data`, `count`, `total`, `page`, `pages`.
- Zod is the validation contract. It parses into `req.validated` instead of mutating Express query objects.
- The state machine is a pure module with no Prisma import. A service performs the transaction.
- Errors are thrown, not handled in every controller. One middleware maps them.
- New files are TypeScript. Existing JavaScript files remain until touched.
- `prisma migrate deploy` is the only migration command used outside a disposable local demo database.

## Phase 1 design

### 1. Error model

New files:

- `server/src/errors/AppError.ts`
- `server/src/errors/prismaErrors.ts`
- `server/src/middleware/error.middleware.ts`
- `server/src/middleware/notFound.middleware.ts`
- `server/src/middleware/requestId.middleware.ts`
- `server/src/logger.ts`

`AppError` carries:

```ts
class AppError extends Error {
  statusCode: number;
  errorCode: string;
  details?: Array<{ field: string; message: string }>;
  expose: boolean;
}
```

The error envelope:

```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Validation failed. Please check your input.",
  "requestId": "3f0c7e8a-...",
  "errors": [{ "field": "title", "message": "Title must be between 10 and 200 characters" }]
}
```

Rules:

- Validation errors return 400 with `VALIDATION_ERROR` and field messages only. Never echo submitted values or passwords.
- Unknown routes return 404 with `NOT_FOUND`.
- Prisma `P2002` maps to 409 `CONFLICT`; `P2025` maps to 404 `NOT_FOUND`; `P2003` maps to 409 `CONFLICT`.
- CORS rejection maps to 403 `CORS_ORIGIN_DENIED`.
- Rate limit rejection maps to 429 `RATE_LIMITED`.
- Unknown errors return 500 `INTERNAL_ERROR`. Stack traces, SQL and `debug` are never included in production.
- `requestId` is echoed in the response header `X-Request-Id` and in the envelope.
- The existing success envelope is unchanged.

Controllers are refactored to throw `AppError` or call `next(error)`. Deliberate fallbacks, such as AI-unavailable response text and optional weather, remain fallbacks.

### 2. Validation

New dependencies: `zod`. New file: `server/src/middleware/validate.ts`. New folder: `server/src/schemas/`.

`validate({ body, query, params })` runs the relevant Zod schemas, assigns parsed values to `req.validated`, and throws `AppError(400, 'VALIDATION_ERROR', ...)` on failure. It does not mutate `req.query`.

Schemas:

| Route group | Rules |
|---|---|
| Auth register | firstName and lastName 2 to 50 characters, no escaping; email normalized to lowercase; password minimum 8 characters with upper, lower, number and symbol; SA phone regex; unknown fields stripped |
| Auth login | email and password required |
| Verify email | 6 digit OTP |
| Report create | title 10 to 200, description 20 to 2000, category from the canonical list, municipality string 2 to 120, optional address 5 to 200, optional latitude and longitude within bounds; unknown fields stripped |
| Report update | title, description, category, municipality, address, latitude and longitude only; no status, userId or team fields |
| Report status | status enum plus optional note up to 500 characters |
| Supervisor assign | positive integer teamId plus optional note |
| Supervisor status | status enum, optional HTTPS afterPhotoUrl, optional note |
| Team create and update | name 2 to 100, specialization 2 to 100, optional municipality, optional coordinates, optional isActive |
| Admin report status | status enum plus optional reason for override |
| Admin user role | role enum |
| Admin user status | isActive boolean |
| AI chat | positive integer reportId, message 1 to 2000, history maximum 20 with roles user and assistant only |
| Public air quality | required latitude and longitude within bounds |
| All `:id` params | positive integer |
| List queries | page 1 or greater, limit 1 to 100, status and category enums, municipality maximum 120 characters |

The canonical category list stays the 11 values used by the client. Before converting the database column to an enum, run `SELECT DISTINCT category FROM "Report"` and map any legacy aliases such as `ROADS`, `WATER`, `POWER`, `ELECTRICITY`, `WASTE` or `LIGHTING`.

The stale `validation.middleware.js` rules are deleted after auth migrates. `express-validator` remains installed until the last route is converted, then is removed.

### 3. Report state machine

New files:

- `server/src/domain/reportStateMachine.ts`
- `server/src/services/report.service.ts`

The pure module exports the allowed transition map and a `canTransition(role, actorId, report, nextStatus, context)` function. The service performs the transaction.

Transitions:

| From | Allowed |
|---|---|
| PENDING | ASSIGNED, IN_PROGRESS, RESOLVED, REJECTED |
| ASSIGNED | ASSIGNED (reassign), IN_PROGRESS, REJECTED |
| IN_PROGRESS | RESOLVED, REJECTED |
| RESOLVED | CLOSED, IN_PROGRESS (reopen) |
| CLOSED | IN_PROGRESS (reopen) |
| REJECTED | PENDING (reopen) |

Role gates:

- CITIZEN: own report only, and only PENDING or IN_PROGRESS to RESOLVED.
- WORKER_SUPERVISOR: triage path in the table above. RESOLVED requires an after-photo URL, either supplied now or already stored.
- MUNICIPAL_ADMIN: canonical transitions.
- SUPER_ADMIN: canonical transitions plus a force override. A force override requires a reason of at least 10 characters and is audited as `OVERRIDE_STATUS`.

Every change runs in one transaction and writes:

- The report status and timestamp fields (`assignedAt`, `resolvedAt`, `closedAt`, `reopenCount`).
- A `ReportStatusHistory` row with from, to, actor, role, note and request ID.
- The existing `ActivityLog` action names, so current tests and the demo keep working.
- No outbox row yet. The outbox arrives in Phase 2A.

Invalid transitions return 409 `INVALID_TRANSITION` with the current and requested statuses. Ownership failures stay 404, so another citizen cannot distinguish a missing report from someone else's report.

### 4. Schema changes

Additive changes only in this phase:

```prisma
model ReportStatusHistory {
  id         Int      @id @default(autoincrement())
  reportId   Int
  report     Report   @relation(fields: [reportId], references: [id], onDelete: Cascade)
  fromStatus String?
  toStatus   String
  actorId    Int?
  actorRole  String?
  note       String?
  requestId  String?
  createdAt  DateTime @default(now())

  @@index([reportId, createdAt])
}

model Report {
  // existing fields
  resolvedAt  DateTime?
  closedAt    DateTime?
  reopenCount Int       @default(0)
  history     ReportStatusHistory[]
}

model ActivityLog {
  // existing fields
  requestId String?
}
```

Indexes:

- `Report(userId, createdAt)`
- `Report(status, createdAt)`
- `Report(assignedTeamId, status)`
- `ReportStatusHistory(reportId, createdAt)`
- `ActivityLog(entity, entityId)`
- `ActivityLog(userId, createdAt)`
- `User(role, isActive)`
- `Team(isActive)`

Enums:

- `Role` becomes an enum if the data audit is clean.
- `ReportStatus` becomes an enum after mapping any legacy values.
- `Category` becomes an enum only after the distinct-value audit. If any legacy value exists, keep it as a string for one release and add a contract test that lists the allowed values.
- `municipality` stays a string. The `Municipality` table is deferred to a later phase.

The schema adds `directUrl = env("DIRECT_URL")` to the datasource. `DATABASE_URL` remains the pooled URL used by the app; `DIRECT_URL` is used only for migrations.

### 5. Migration strategy

The existing `20260101000000_init` migration is stale. It predates `Team`, email verification fields, assignment fields and `afterPhotoUrl`. Production was created with `db push`, so `_prisma_migrations` is absent or meaningless.

Procedure, performed on a Neon branch first:

1. Take a `pg_dump` backup of production.
2. Create a Neon branch from production.
3. Run `prisma migrate diff` from the branch to the Prisma schema. If the output is not empty, reconcile the schema or codify the drift before continuing.
4. Replace the stale init with a baseline migration generated from the live branch.
5. Apply the baseline to the branch, then apply the new Phase 1 migration.
6. Verify counts, enum values, indexes and the 34-step HTTP workflow against the branch.
7. Snapshot production again.
8. On production, mark the baseline as applied once, then run `prisma migrate deploy`.
9. Confirm `prisma migrate diff` against production is empty.

Rules:

- No `db push` in production, CI or the demo verification script.
- `prisma db push` may remain a local convenience only, and is never the source of truth.
- Migrations use expand and contract. Add nullable columns and tables first, backfill in batches, and drop only in a later release.
- Every migration must run against the previous release's code.
- Migrations set a short `lock_timeout` where supported.

Render:

```yaml
buildCommand: npm ci --include=dev && npx prisma generate && npm run build
startCommand: npx prisma migrate deploy && node dist/server.js
healthCheckPath: /health
autoDeploy: false
```

Render free has no pre-deploy command, so the migration runs before the server starts. A single free instance plus the Prisma advisory lock prevents concurrent migration runs.

### 6. TypeScript enablement

New TypeScript files need a build and runtime path in the same phase.

- `server/tsconfig.json`: `allowJs: true`, `checkJs: false`, `noEmit: false`, `outDir: dist`, `rootDir: src`, `module: commonjs`, `target: ES2022`, `moduleResolution: node`, `esModuleInterop: true`, `strict: false`, `skipLibCheck: true`.
- `include`: `src/**/*.ts` and `src/**/*.js`.
- `npm run typecheck`: `tsc --noEmit`.
- `npm run build`: `tsc`.
- `npm start`: `node dist/server.js`.
- `npm run dev`: `tsx watch src/server.js`.
- `npm test`: `node --import tsx --test` so tests can import TypeScript modules.
- `demo` and `demo:verify` start the server with `tsx` so the demo uses the same source as development.
- CI adds `npm run typecheck` before tests.
- Strictness stays off in this phase. It is raised directory by directory in Phase 5.
- The module system stays CommonJS until the server conversion is complete. Do not mix ESM mid-migration.

### 7. Health and readiness

- `GET /health` is DB-free liveness. It returns 200 with status, uptime, version and timestamp. Render and the 5-minute keep-alive monitor use it, so Neon is not woken every few minutes.
- `GET /ready` runs `SELECT 1` with a 2-second timeout and checks the migrations table for failed or unfinished rows. It returns 200 with `{ status: "ready", checks: { database: "up", migrations: "current" } }` or 503.
- The 30-minute external readiness check uses `/ready`. This detects database outages without keeping Neon awake around the clock.
- The existing `/health` response keeps `status: "Success"` for current tests and adds the new fields.

### 7. Logging and request IDs

- Add `pino` and `pino-http`.
- Accept a valid inbound `X-Request-Id` or generate a UUID.
- Log method, URL, status, duration, user ID, request ID and release SHA.
- Redact authorization headers, cookies, passwords, tokens and OTPs.
- Suppress `/health` and `/` from normal logs.
- Replace `console.*` in `server.js`, middleware, controllers, `db.config.js`, `retry.js` and services.
- Add `requestId` to `ActivityLog`.

### 8. Rate limiting and CORS

- Remove the duplicate inline rate limiter from `server.js`.
- Keep one global limiter plus auth, AI and email verification limiters.
- Use `ipKeyGenerator` for IPv6 keys.
- Keep the in-memory store in this phase and document the single-instance limitation.
- Return `429 RATE_LIMITED` in the standard error envelope.
- Map CORS rejection to a JSON 403 response.

### 9. Tests

New tests:

- `validation.test.js`: every mutating route rejects bad input, strips unknown fields, does not leak values, and stores names verbatim.
- `stateMachine.test.js`: transition matrix, role gates, after-photo rule and force-override reason.
- `transitions.test.js`: citizen, supervisor and admin use one service; history rows are written; invalid jumps return 409.
- `errors.test.js`: 404, Prisma mapping, request ID echo and no internals in production.
- `health.test.js`: `/health` does not query the database; `/ready` reports up and down.
- Migration drift check in CI: deploy from empty, run `prisma migrate diff --exit-code`, and reject edits to migrations already on `main`.

Existing tests that assert an admin can set any status are updated to the canonical transitions. The demo's activity log action names and order stay unchanged.

## Acceptance criteria

- Every mutating endpoint validates its input and returns 400 with field errors.
- Invalid IDs return 400, not 500.
- Names with apostrophes are stored verbatim.
- Citizens, supervisors and admins use one state machine. Invalid transitions return 409.
- Force override requires a reason and writes an audit entry.
- `ReportStatusHistory` records every transition.
- The error envelope includes `requestId` and never includes internals in production.
- Logs are structured, correlated and redacted.
- `/health` is DB-free and `/ready` checks the database and migrations.
- A fresh database migrates to the current schema with `migrate deploy`, and `migrate diff` is empty.
- Render no longer runs `db push`.
- Existing API paths and success payloads are unchanged.
- Server tests, the PostgreSQL workflow, client lint and client build pass in CI.

## Risks

- The baseline migration is a one-way operation. Mitigate with a fresh dump, a Neon branch rehearsal and a rollback plan.
- Enum conversion can fail on unknown values. Audit and map before converting.
- Enforcing the state machine changes admin behavior and some existing tests. Update the tests and the admin UI together.
- The response envelope changes for errors only. Confirm that every client page reads `message` and `errorCode` safely.
- Pino must never log request bodies. Redaction is mandatory.
- In-memory rate limiting is only correct on one instance. Document it and revisit if Render scales.
- TypeScript files introduced alongside CommonJS JavaScript require `tsx` in development and `tsc` for production. Keep the module system CommonJS until the server conversion is complete.

## Rollout

1. Open the Phase 1 PR with the spec and plan.
2. Implement in small commits: errors and request IDs, validation, state machine, schema and migrations, health, logging, tests.
3. Run the full local suite and the PostgreSQL workflow.
4. Push, wait for CI, merge the PR.
5. Deploy to Render and verify `/health`, `/ready`, migrations and a report lifecycle.
6. Only then begin Phase 2A.
