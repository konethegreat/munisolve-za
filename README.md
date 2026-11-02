# MuniSolve ZA

A South African civic-tech portfolio project by **Kone Tshivhinda**. Citizens report infrastructure faults and track their reports; supervisors assign crews and record progress; municipal administrators manage reports and users.

**Try the [synthetic local walkthrough](docs/DEMO.md).** It runs the actual React interface, Express API and PostgreSQL database with fictional accounts, without requiring AI, email, weather or Google credentials.

![Citizen report progress in the synthetic local demo](docs/images/citizen-pending.png)

## Demonstrated features

- Citizen fault submission with category, municipality and a map location.
- Own-report access: another citizen cannot open, edit or delete a report.
- Supervisor triage, crew suggestions, assignment, progress and resolution.
- A required after-photo URL on the supervisor resolution endpoint.
- Municipal admin report and user management, with an activity-log API.
- JWT authentication, bcrypt passwords, current database role/account checks, Helmet headers, CORS and rate limits.
- Optional Siyanda (Anthropic), Resend email and Google sign-in; keyless weather, air quality, holidays and geocoding; signed outbound webhooks; public map and data widgets.

The reproducible path is `PENDING → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`.
Transitions are enforced server-side by the table below; an invalid move returns 409.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22.12+; Express 5 |
| Data | PostgreSQL; Prisma 6 |
| Interface | React 19; Vite 7; Tailwind CSS 4; React Router 7 |
| Maps | Leaflet; React Leaflet; OpenStreetMap |
| Optional providers | Anthropic; Resend; Google OAuth |
| Keyless data | Open-Meteo (weather, air quality); Nager.Date (holidays); Nominatim (geocoding) |

## Reproduce the workflow

Install Node.js 22.12+ and Docker, then:

```sh
git clone https://github.com/konethegreat/munisolve-za.git
cd munisolve-za
npm --prefix server ci
npm --prefix client ci
npm --prefix server run demo:verify
```

Verification creates a new PostgreSQL 16 container, seeds four fictional users and two crews, starts the real API, checks 49 HTTP steps, and removes its processes and database. It checks permissions, every lifecycle state, missing-photo rejection, keyless reporting and audit history. Credentials are generated per run and are not saved to files or printed.

For the interactive interface, set a temporary `DEMO_PASSWORD` of at least 12 characters and run `npm --prefix server run demo`. The launcher prints a local login URL. [The walkthrough](docs/DEMO.md) has shell commands, accounts, expected results and screenshots. Stop with Ctrl+C to discard that database.

## Checks

```sh
npm --prefix server audit --audit-level=low
npm --prefix client audit --audit-level=low
npm --prefix server test
npm --prefix server run demo:verify
npm --prefix client run lint
npm --prefix client run build
```

GitHub Actions runs both dependency audits, API tests with stubbed external dependencies, the actual PostgreSQL HTTP workflow, and client lint/build. Audits include development dependencies and fail on findings of any severity. The browser walkthrough is a separate manual check; CI does not automate the UI.

## Regular local development

Use your own development PostgreSQL database and untracked `server/.env` with `DATABASE_URL`, `DIRECT_URL`, a random `JWT_SECRET`, `CLIENT_URL=http://localhost:5173` and `NODE_ENV=development`.

```sh
DATABASE_URL=postgresql://user:password@localhost:5432/munisolve
# Non-pooled Neon URL used by migrations; equals DATABASE_URL for a local Postgres.
DIRECT_URL=postgresql://user:password@localhost:5432/munisolve
```

`schema.prisma` reads both variables, so the Prisma commands fail with P1012 if only `DATABASE_URL` is set. Provider credentials are optional for basic reporting: without them AI chat is unavailable and email verification cannot deliver mail.

```sh
npm --prefix server run db:deploy
npm --prefix server run dev
```

`db:deploy` applies the tracked migrations in `server/prisma/migrations` to your disposable development database. In another terminal, run `npm --prefix client run dev`. The client defaults to `http://localhost:5000/api`; use `VITE_API_URL` to change it. Configure `VITE_GOOGLE_CLIENT_ID` and matching server `GOOGLE_CLIENT_ID` to enable Google sign-in. `npm --prefix server run db:push` remains available as a local convenience for a disposable database, but it skips the tracked migration history; use `db:deploy` whenever migration state matters.

The server runs under `tsx watch` and restarts when imported source files change. Restart it manually after changing environment variables or the Prisma schema.

## Roles and API entry points

| Role | Demonstrated access |
|---|---|
| `CITIZEN` | Own reports; no admin or supervisor endpoints |
| `WORKER_SUPERVISOR` | Operational reports and crews through `/api/supervisor`; no admin endpoints |
| `MUNICIPAL_ADMIN` | Admin and supervisor endpoints |
| `SUPER_ADMIN` | Admin and supervisor endpoints |

Auth: `/api/auth`; citizen reports: `/api/reports`; operations: `/api/supervisor`; administration: `/api/admin`; chat: `/api/ai`; public widgets: `/api/public`; geocoding: `/api/geo`. `/health` checks API availability. Audit records are available through `/api/admin/activity-logs`; the current admin interface has reports and users tabs.

## API contracts and operations

Every error response uses one envelope with a request ID, so a caller can quote it when reporting a problem:

```json
{
  "success": false,
  "errorCode": "VALIDATION_ERROR",
  "message": "Validation failed. Please check your input.",
  "requestId": "3f0c7e8a-...",
  "errors": [{ "field": "title", "message": "Title must be between 10 and 200 characters" }]
}
```

Success payloads are unchanged. Validation errors return 400 `VALIDATION_ERROR` with field messages only. Ownership failures stay 404, so one citizen cannot distinguish a missing report from another citizen's report.

Status changes run through one transaction-backed state machine:

| From | Allowed |
|---|---|
| `PENDING` | `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `REJECTED` |
| `ASSIGNED` | `ASSIGNED` (reassign), `IN_PROGRESS`, `REJECTED` |
| `IN_PROGRESS` | `RESOLVED`, `REJECTED` |
| `RESOLVED` | `CLOSED`, `IN_PROGRESS` (reopen) |
| `CLOSED` | `IN_PROGRESS` (reopen) |
| `REJECTED` | `PENDING` (reopen) |

Invalid transitions return 409 `INVALID_TRANSITION`. Assignment and reassignment go through `PATCH /api/supervisor/reports/:id/assign`; the status endpoints reject `ASSIGNED` with 400 `ASSIGNMENT_REQUIRED`. Citizens can only resolve their own `PENDING` or `IN_PROGRESS` reports; a supervisor resolution requires an after-photo URL; a `SUPER_ADMIN` override requires a reason of at least 10 characters. Every change writes a `ReportStatusHistory` row and keeps the existing `ActivityLog` action names.

`GET /health` is a DB-free liveness probe used by Render and the keep-alive monitor, so it does not wake Neon. `GET /ready` checks the database and the migrations table and returns 200 with `database: "up"` and `migrations: "current"`, or 503.

`DATABASE_URL` is the pooled Neon connection string used by the API. `DIRECT_URL` is the direct Neon URL used only by migrations.

## Scheduled SLA checks

Reports carry a response target and a resolution target chosen by category. A tick finds reports approaching (80% of the window) or past those targets, writes one notification per report, cycle and recipient to the `NotificationOutbox` table, and emails through Resend with bounded retries.

The tick is `POST /api/internal/tick` and requires the `x-tick-secret` header. `.github/workflows/sla-tick.yml` calls it hourly (`5 * * * *`). Hourly is deliberate: a five-minute tick would wake Neon's free compute continuously and exceed the monthly allowance. Detection is therefore up to one hour late, which is acceptable for targets measured in hours and days. GitHub disables scheduled workflows after 60 days without repository activity; use manual dispatch if that happens.

Repository secrets required by the workflow:

- `MUNISOLVE_API_URL` — the API origin, without a trailing slash.
- `TICK_SECRET` — the same random value set on the Render service.

Email delivery uses `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Without them the outbox marks rows `SKIPPED` instead of retrying forever. Policies are seeded in the migration; changing a target is a new migration.

## Integrations and webhooks

Weather snapshots come from Open-Meteo and need no API key. Lookups are cached for ten minutes, time out after eight seconds and fail quietly, so a weather outage never blocks a report. Set `WEATHER_ENABLED=false` to skip them.

Geocoding is proxied through `GET /api/geo/search?q=...&limit=...` and `GET /api/geo/reverse?lat=...&lon=...` so the browser never calls Nominatim directly. The proxy sends an identifying `User-Agent` (override with `GEO_USER_AGENT`), allows at most one upstream request per second, caches results for a day and restricts searches to South Africa (`GEO_COUNTRY_CODES`, default `za`). Every response carries `© OpenStreetMap contributors, ODbL` attribution. Set `GEO_ENABLED=false` to disable it.

Administrators can register webhook subscriptions through `/api/admin/webhooks`. Supported events are `report.created`, `report.assigned`, `report.status_changed`, `report.merged` and `report.unmerged`. The signing secret is shown once, on creation or rotation. Each delivery carries:

| Header | Value |
|---|---|
| `X-MuniSolve-Event` | Event name |
| `X-MuniSolve-Delivery` | Delivery row ID |
| `X-MuniSolve-Timestamp` | Unix seconds |
| `X-MuniSolve-Signature` | `sha256=` + HMAC-SHA256 of `` `${timestamp}.${body}` `` |

Verify the signature with the subscription secret before trusting a payload. Deliveries are stored in `WebhookDelivery` and sent by the hourly tick with bounded retries; 429, 5xx and network failures retry, other 4xx responses and private-address targets fail permanently. Subscription URLs must be public HTTPS origins; the hostname is resolved again at delivery and private addresses are refused, and redirects are not followed. Delivery history is available at `GET /api/admin/webhooks/:id/deliveries`.

The API description is served at `GET /api/openapi.json`, with a dependency-free browser index at `GET /api/docs`.

## Duplicate reports and automatic assignment

When a report is created with coordinates, the API compares it with open reports in the same category family: a zero-cost bounding-box query followed by a Haversine distance check and a title-similarity score. Matches above 0.65 are stored as `DuplicateCandidate` rows and returned with the creation response. A near-certain match (0.9 or more) from the same reporter is merged immediately.

`GET /api/reports/:id/duplicates` lists suggestions to the owner or an admin. Confirming a duplicate closes the report as `DUPLICATE`, points it at the canonical report, clears its SLA and team, records a `MergeRecord` and follows it for the reporter. Dismissing keeps both reports. `POST /api/admin/reports/:id/unmerge` restores a merged report to `PENDING` with fresh SLA windows.

The same tick that runs SLA checks can also assign crews. It evaluates `PENDING`, unassigned reports that are at least five minutes old, scores active teams in the same municipality on skill (40), distance (up to 30), municipality (20) and free capacity (up to 10), and assigns only when the winner scores at least 70 with a lead of 15 over the runner-up. Reports with no coordinates, category `OTHER`, or an open duplicate suggestion are skipped. Every evaluation writes one `AssignmentDecision` row with the mode and reasons, assignment history shows `SYSTEM`, and active admins receive one outbox notification. Set `AUTO_ASSIGN_ENABLED=true` on the API to enable it; each team also needs `autoAssignEnabled` (teams are off by default). The flag is off in `render.yaml` and on in `npm run demo`.

Local commands, from `server/`:

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run demo:verify
```

Schema changes ship as versioned migrations in `server/prisma/migrations`; production, CI and `demo:verify` run `prisma migrate deploy` only. Before the first deployment that uses `migrate deploy`, run this once against the existing production database to mark the baseline as already applied:

```sh
npx prisma migrate resolve --applied 20261102000000_baseline
```

## Evidence and limits

[Demo evidence](docs/DEMO.md#recorded-evidence) covers a local synthetic workflow. It does not verify the hosted Vercel/Render/Neon deployment, real municipal receipt or repairs, AI answers, email delivery, Google OAuth, live weather or geocoding responses, or delivery to a real webhook receiver. The photo field stores a URL; the demo uses a placeholder rather than a verified upload. Status updates are seen after navigation or refresh. Municipal admins currently have global report visibility; municipality names are not tenant isolation.

The October 3, 2026 dependency refresh reduced the server and client npm audit results from 17 findings each to zero. [Dependency maintenance notes](docs/DEPENDENCIES.md) explain the Prisma override and how to reproduce the checks. This records known npm advisories on that date; workflow tests and dependency audits do not establish complete application security.

## Developer

**Kone Tshivhinda** — Full-stack developer, Johannesburg, South Africa.

- [LinkedIn](https://za.linkedin.com/in/kone-tshivhinda-32a760233)
- [Email](mailto:erictshivhinda@gmail.com)

© 2026 Kone Tshivhinda. All rights reserved. Proprietary software for portfolio evaluation.
