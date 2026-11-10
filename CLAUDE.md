# CLAUDE.md - MuniSolve ZA Project Context

This file is the authoritative reference for Claude Code in this repository. Read this before asking questions or exploring the codebase.

---

## What This Project Is

MuniSolve ZA is a South African civic-tech platform. Citizens report municipal infrastructure failures (potholes, power outages, water leaks, etc.) and track resolution progress. Admins manage reports and users through a back-office dashboard. Supervisors triage and assign reports to maintenance crews. An embedded AI assistant called **Siyanda** (powered by Anthropic Claude) guides citizens through the reporting process.

**Owner:** Kone Tshivhinda - Full-Stack Developer, Johannesburg, SA  
**Email:** erictshivhinda@gmail.com  
**Status:** Portfolio project with a reproducible local synthetic workflow. Hosted deployment and provider behavior are not verified by that demonstration. See `docs/DEMO.md` for current evidence and limitations.

---

## Repository Layout

```
munisolve-za/
├── client/                   # React 19 frontend (Vite)
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.js              # Axios instance (base URL + auth interceptor)
│   │   │   └── publicApi.js          # Keyless public API calls
│   │   ├── components/
│   │   │   ├── AdminRoute.jsx        # Role guard - MUNICIPAL_ADMIN/SUPER_ADMIN only
│   │   │   ├── SupervisorRoute.jsx   # Role guard - WORKER_SUPERVISOR/MUNICIPAL_ADMIN/SUPER_ADMIN
│   │   │   ├── ProtectedRoute.jsx    # Auth guard - redirects to /login
│   │   │   ├── SiyandaChat.jsx       # AI chat panel (per-report)
│   │   │   ├── IncidentMap.jsx       # Leaflet heatmap component
│   │   │   ├── ReportCard.jsx        # Report list item
│   │   │   ├── WeatherBadge.jsx      # Inline weather display
│   │   │   ├── AirQualityBadge.jsx
│   │   │   ├── HolidayBanner.jsx
│   │   │   ├── StatsSection.jsx      # Animated counters for landing page
│   │   │   ├── AnimatedCounter.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── MunicipalitySelector.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # React context shape
│   │   │   └── AuthProvider.jsx      # JWT decode, user state, login/logout/updateUser helpers
│   │   ├── hooks/
│   │   │   └── useAuth.js            # Consumes AuthContext
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx       # Public home (stats, air quality, holiday banner)
│   │   │   ├── About.jsx
│   │   │   ├── Login.jsx             # Email/password + Google OAuth button (active)
│   │   │   ├── Register.jsx          # Redirects to /verify-email after success
│   │   │   ├── VerifyEmail.jsx       # 6-digit OTP input, resend with cooldown
│   │   │   ├── Dashboard.jsx         # Citizen report list + unverified email banner
│   │   │   ├── ReportFault.jsx       # Report submission form
│   │   │   ├── ReportDetail.jsx      # Single report + Siyanda chat
│   │   │   ├── MapPage.jsx           # Leaflet heatmap full page
│   │   │   ├── SupervisorDashboard.jsx # 3-panel ops dashboard (triage/active/teams)
│   │   │   └── Admin.jsx             # Admin back-office (tabs: reports, users, logs)
│   │   ├── utils/
│   │   │   └── mapUtils.js
│   │   ├── App.jsx                   # Route definitions
│   │   └── main.jsx                  # Wraps app with GoogleOAuthProvider + BrowserRouter
│   ├── vite.config.js
│   └── vercel.json                   # SPA rewrite rules for Vercel
│
└── server/                   # Express.js backend (TypeScript)
    ├── prisma/
    │   ├── schema.prisma             # Single source of truth for DB schema
    │   ├── migrations/               # Immutable versioned migrations
    │   ├── seedAdmin.ts              # Creates/resets one MUNICIPAL_ADMIN
    │   └── seedDemo.ts               # Synthetic local demo data (local only)
    ├── scripts/
    │   ├── demo.ts                   # Disposable Docker demo launcher (tsx)
    │   ├── start-demo-server.ts      # Demo API entry (tsx)
    │   └── verify-workflow.ts        # Real PostgreSQL HTTP workflow check
    └── src/
        ├── config/
        │   ├── db.config.ts          # Prisma client singleton (+ retry wrapper)
        │   └── retry.ts              # Bounded retry for transient DB errors
        ├── controllers/              # .ts route handlers; docs/health/tick/webhook/duplicate already TS
        ├── domain/                   # Pure report state machine
        ├── errors/AppError.ts
        ├── logger.ts                 # Pino logger (silent under NODE_ENV=test)
        ├── middleware/               # auth, authz, role guards, rate limits, validate, ids, errors
        ├── openapi/                  # API description
        ├── routes/                   # .ts routers; export = router for require() consumers
        ├── schemas/                  # Zod request contracts
        ├── services/                 # SLA, outbox, duplicate, webhook, weather, geo, email
        ├── types/express.d.ts        # Request augmentation (id, validated, user, token)
        └── server.ts                 # Entry point - middleware wiring, route mounting
```

---

## Tech Stack (exact versions)

| | |
|---|---|
| **Node.js** | 22.12+ (CI uses Node 22) |
| **Express** | 5.x |
| **Prisma** | 6.x (see server/package.json; the adapter-pg package is not used by the current client configuration) |
| **Database** | PostgreSQL via Neon (serverless) |
| **React** | 19.2 |
| **Vite** | 7.x |
| **Tailwind CSS** | 4.x (PostCSS plugin: `@tailwindcss/postcss`) |
| **React Router** | 7.x |
| **Leaflet** | 1.9 + react-leaflet 5 + leaflet.heat 0.2 |
| **Axios** | 1.x |
| **Lucide React** | 0.564 (icons) |
| **Google OAuth** | `@react-oauth/google` 0.13 (active - `GoogleOAuthProvider` in `main.jsx`) |
| **JWT** | `jsonwebtoken` |
| **bcrypt** | `bcryptjs` (12 salt rounds) |
| **Helmet** | express-rate-limit + helmet |
| **Resend** | `resend` npm package - transactional email for OTP verification |
| **AI** | `@anthropic-ai/sdk` (Claude model, Siyanda) |

---

## Database Schema (Prisma)

> **Schema management:** Schema changes ship as versioned migrations in `server/prisma/migrations`. Production, CI and `demo:verify` run `prisma migrate deploy`; the baseline was marked as applied once. Do not use `prisma db push` against a database whose migration history matters.

```prisma
model User {
  id                Int           @id @default(autoincrement())
  email             String        @unique
  password          String        // bcrypt hash; empty string for Google-only accounts
  firstName         String
  lastName          String
  googleId          String?       @unique
  phone             String?
  role              String        @default("CITIZEN")
  // roles: CITIZEN | MUNICIPAL_ADMIN | SUPER_ADMIN | WORKER_SUPERVISOR
  isActive          Boolean       @default(true)
  isVerified        Boolean       @default(false)
  lastLogin         DateTime?
  emailVerifToken   String?       // SHA-256 hash of OTP - never stored plaintext
  emailVerifExpiry  DateTime?     // 15-minute window
  createdAt         DateTime      @default(now())
  reports           Report[]
  activityLogs      ActivityLog[]
}

model Team {
  id             Int      @id @default(autoincrement())
  name           String
  specialization String   // e.g. "Roads & Infrastructure", "Water & Sanitation"
  municipality   String?
  latitude       Float?   // team base coordinates for proximity matching
  longitude      Float?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  reports        Report[]
}

model Report {
  id               Int       @id @default(autoincrement())
  title            String
  description      String
  category         String
  municipality     String
  address          String?
  latitude         Float?
  longitude        Float?
  status           String    @default("PENDING")
  // statuses: PENDING | ASSIGNED | IN_PROGRESS | RESOLVED | REJECTED | CLOSED
  weatherTemp      Float?
  weatherCondition String?
  weatherRainfall  Float?
  weatherWind      Float?
  weatherHumidity  Float?
  assignedTeamId   Int?
  team             Team?     @relation(fields: [assignedTeamId], references: [id])
  assignedAt       DateTime?
  afterPhotoUrl    String?   // required to transition IN_PROGRESS → RESOLVED
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  userId           Int
  user             User      @relation(fields: [userId], references: [id])
}

model ActivityLog {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  action      String
  // actions: REGISTER | LOGIN | LOGIN_FAILED | LOGOUT | EMAIL_VERIFIED |
  //          CREATE_REPORT | UPDATE_STATUS | REPORT_ASSIGNED | REPORT_STATUS_CHANGED |
  //          TEAM_CREATED | TEAM_UPDATED | ADMIN_* actions
  entity      String
  entityId    Int
  description String?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
}
```

---

## All API Routes

### Auth `/api/auth`
```
POST   /register             Public + authLimiter - create account; sends OTP email; returns JWT
POST   /login                Public + authLimiter - returns JWT
POST   /google               Public + authLimiter - Google OAuth (body: { idToken }); returns JWT
POST   /send-verification    Public + emailVerifLimiter - resend OTP (body: { email })
POST   /verify-email         Public + emailVerifLimiter - verify OTP (body: { email, otp })
GET    /me                   Private - current user profile
POST   /logout               Private - logs activity, stateless
```

### Reports `/api/reports`  *(all require auth)*
```
POST   /                  create report
GET    /                  list (citizen: own; admin/supervisor: all)
GET    /:id               single report
PUT    /:id               full update
PATCH  /:id/status        status update only
DELETE /:id               delete
```

### AI `/api/ai`  *(auth + aiChatLimiter)*
```
POST   /chat              body: { reportId, message, history: [{role, content}] }
                          30 messages/hour per user, keyed by user ID
```

### Admin `/api/admin`  *(auth + requireAdmin - MUNICIPAL_ADMIN or SUPER_ADMIN)*
```
GET    /dashboard                   aggregate stats
GET    /reports                     all reports
GET    /reports/:id                 single
PATCH  /reports/:id/status          update status (valid: PENDING|IN_PROGRESS|RESOLVED|REJECTED|CLOSED; assign with PATCH /api/supervisor/reports/:id/assign)
DELETE /reports/:id

GET    /users                       all users
GET    /users/:id                   single
PATCH  /users/:id/status            activate/deactivate
PATCH  /users/:id/role              change role (valid: CITIZEN|MUNICIPAL_ADMIN|SUPER_ADMIN|WORKER_SUPERVISOR)
DELETE /users/:id

GET    /activity-logs               full audit trail
```

### Supervisor `/api/supervisor`  *(auth + requireSupervisor - WORKER_SUPERVISOR | MUNICIPAL_ADMIN | SUPER_ADMIN)*
```
GET    /dashboard                       stats (pending, assigned, inProgress, resolved, closed, teams)
GET    /reports/triage                  PENDING reports, oldest-first
GET    /reports/active                  ASSIGNED + IN_PROGRESS reports
GET    /reports/:id                     single report (includes team relation)
PATCH  /reports/:id/assign              body: { teamId, note? } - sets ASSIGNED + assignedAt
PATCH  /reports/:id/status             body: { status, afterPhotoUrl?, note? }
                                        RESOLVED requires afterPhotoUrl (enforced server-side)
GET    /reports/:id/suggestions         proximity + specialization-matched team list for a report
GET    /teams                           all teams with activeTickets count
POST   /teams                           create team (body: { name, specialization, municipality?, latitude?, longitude? })
PATCH  /teams/:id                       update team
```

### Public `/api/public`  *(no auth, cached)*
```
GET    /stats             1-min cache - totalReports, pending, inProgress, resolved, rejected,
                                         resolutionRate, municipalitiesServed, categories[], topMunicipalities[]
GET    /air-quality?lat=&lon=         30-min cache - Open-Meteo API (keyless)
GET    /holidays                      24-hr cache - Nager.Date SA holidays (keyless)
```

---

## Frontend Routes

```
/                 LandingPage          Public
/about            About                Public
/register         Register             Public
/login            Login                Public
/verify-email     VerifyEmail          Public - OTP input; email passed via router state or useAuth
/dashboard        Dashboard            ProtectedRoute - amber banner shown if !user.isVerified
/report           ReportFault          ProtectedRoute
/reports/:id      ReportDetail         ProtectedRoute
/map              MapPage              ProtectedRoute
/supervisor       SupervisorDashboard  SupervisorRoute (WORKER_SUPERVISOR | MUNICIPAL_ADMIN | SUPER_ADMIN)
/admin            Admin                AdminRoute (MUNICIPAL_ADMIN | SUPER_ADMIN)
```

---

## Security Architecture

| Concern | Implementation |
|---|---|
| Auth | JWT, 24h expiry, `req.user` set by `auth.middleware.js` |
| Passwords | bcrypt, 12 salt rounds |
| Google OAuth | `google-auth-library` verifyIdToken; findUnique+update/create (not upsert - avoids unique constraint conflicts); Google users auto-verified |
| Email OTP | 6-digit code; stored as SHA-256 hash; 15-min expiry; compared with `crypto.timingSafeEqual` |
| RBAC | `role` field on User; `requireAdmin` for admin routes; `requireSupervisor` for ops routes |
| Rate limits | Auth: 5/15min · General: 100/15min · AI: 30/hr (userId) · Email OTP: 5/hr (IP) |
| Headers | Helmet.js (CSP, HSTS, XSS, X-Frame-Options) |
| CORS | Strict allowlist: `localhost:5173` + `CLIENT_URL` env var |
| Proxy trust | `app.set('trust proxy', 1)` - Render sits behind a proxy |
| Activity log | Every auth event + all report/team/role changes written to ActivityLog |

---

## Supervisor Workflow - Status State Machine

```
PENDING → ASSIGNED | IN_PROGRESS | RESOLVED | REJECTED
ASSIGNED → ASSIGNED (reassign) | IN_PROGRESS | REJECTED
IN_PROGRESS → RESOLVED | REJECTED
RESOLVED → CLOSED | IN_PROGRESS (reopen)
CLOSED → IN_PROGRESS (reopen)
REJECTED → PENDING (reopen)
```

Assignment goes through `PATCH /api/supervisor/reports/:id/assign`; the status endpoint rejects `ASSIGNED`. The canonical matrix and role gates live in `server/src/domain/reportStateMachine.ts`, and every transition is written with history and an activity row in `server/src/services/report.service.ts`. A `WORKER_SUPERVISOR` transition to `RESOLVED` requires an after-photo URL from the request body or the existing record, otherwise it fails with 400 `AFTER_PHOTO_REQUIRED`. `SUPER_ADMIN` may force any transition with a reason of at least 10 characters, audited as `OVERRIDE_STATUS`.

Proximity matching in `getTeamSuggestions`: Haversine distance + category→specialization keyword scoring. Teams sorted by `specScore * 10 + muniMatch * 5 - distanceKm`.

---

## Environment Variables

### Server (`server/.env`)
```
DATABASE_URL=          # Neon PostgreSQL connection string
DIRECT_URL=            # Non-pooled Neon URL used by migrations; equals DATABASE_URL for a local Postgres
JWT_SECRET=            # Long random string
JWT_EXPIRES_IN=24h     # Optional, defaults to 24h
ANTHROPIC_API_KEY=     # Claude API key for Siyanda
GOOGLE_CLIENT_ID=      # Google OAuth client ID
RESEND_API_KEY=        # Resend transactional email API key
RESEND_FROM_EMAIL=     # Verified sender (use onboarding@resend.dev for dev/testing)
CLIENT_URL=            # Vercel frontend URL (exact, no trailing slash)
NODE_ENV=              # development | production
PORT=5000              # Optional
```

### Client (`client/.env`)
```
VITE_API_URL=              # Render backend URL
VITE_GOOGLE_CLIENT_ID=     # Same value as server GOOGLE_CLIENT_ID - needed by @react-oauth/google
```

---

## Development Commands

The repeatable demo uses a new PostgreSQL 16 Docker container and clears provider
credentials. From the repo root, run `npm --prefix server ci` and
`npm --prefix client ci`, then `npm --prefix server run demo:verify` for the 34-step
real HTTP/PostgreSQL check. For the browser demo, set a temporary `DEMO_PASSWORD`
of at least 12 characters and run `npm --prefix server run demo`. Ctrl+C removes
its own database and processes. See `docs/DEMO.md` for the four synthetic accounts.
AI and email clients are optional at startup; without a key, AI chat returns 503
after ownership validation and report submission returns `aiResponse: null`.

```bash
# Backend
cd server
npm ci --include=dev        # install dependencies, including build tooling
npx prisma generate         # generate the Prisma client
npx prisma migrate deploy   # apply the versioned migrations
npm run typecheck           # tsc --noEmit (src + prisma/scripts via tsconfig.tools.json)
npm test                    # node --test with tsx
npm run build               # tsc → dist/server.js
npm run dev                 # tsx watch src/server.ts
npm run demo:verify         # disposable PostgreSQL 16 HTTP workflow
npx prisma studio           # visual DB browser

# Frontend
cd client
npm ci
npm run dev                 # Vite dev server → http://localhost:5173
npm run build               # production build
npm run lint                # ESLint
```

---

## Deployment

| Service | What | Key config |
|---|---|---|
| **Render** | Express API | All server env vars set; `trust proxy 1` already set; health check `/health` |
| **Vercel** | React SPA | `vercel.json` rewrites all paths to `index.html`; `VITE_GOOGLE_CLIENT_ID` must be set |
| **Neon** | PostgreSQL | Serverless; `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, migrations only) in Render env |
| **Resend** | Transactional email | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in Render env |
| **Google Cloud** | OAuth | Authorized JS origins must include both `localhost:5173` and the Vercel production URL |

Render builds with `npm ci --include=dev && npx prisma generate && npm run build` and starts with `npx prisma migrate deploy && node dist/server.js`. `GET /health` is DB-free liveness; `GET /ready` checks the database and migrations. Before the first deployment that uses `migrate deploy`, mark the baseline as applied once against the existing production database:

```bash
npx prisma migrate resolve --applied 20261102000000_baseline
```

---

## Key Patterns & Gotchas

- **Prisma client** is a singleton in `server/src/config/db.config.ts` - always import from there, never instantiate a new `PrismaClient`.
- **TypeScript** - all server source, seeds and scripts are TypeScript. Modules that are consumed through `require()` (`db.config`, routers, `server.ts`) use `export =`; modules consumed with named imports use named exports. Tests and scripts run through `tsx`, so extensionless imports resolve `.ts`. `npm run typecheck` covers `src` plus `prisma`/`scripts` through `tsconfig.tools.json`, while `npm run build` emits only `src` to `dist`.
- **Operations** - deploy, rollback, backup/restore and incident guidance live in `docs/OPERATIONS.md`. `.github/workflows/keep-api-awake.yml` pings `/health` every 10 minutes; `.github/workflows/sla-tick.yml` runs the hourly SLA/outbox tick.
- **Schema changes** - add a versioned migration in `server/prisma/migrations`; production, CI and `demo:verify` use `prisma migrate deploy`. Do not use `prisma db push` against a database whose migration history matters.
- **Roles** - the actual role strings are `CITIZEN`, `MUNICIPAL_ADMIN`, `SUPER_ADMIN`, `WORKER_SUPERVISOR`. The old CLAUDE.md incorrectly said `ADMIN`/`SUPERADMIN` - those are wrong.
- **Google OAuth** - uses explicit `findUnique` + `update/create` instead of `upsert`. The upsert caused Prisma "invalid invocation" errors due to dual unique fields (`email` + `googleId`). Do not revert to upsert.
- **Google JWT payload** - signed as `{ userId, email, role }`. The `googleLogin` handler previously used `{ id }` which broke `auth.middleware.js` (reads `decoded.userId`). Fixed.
- **Email OTP** - stored as a SHA-256 hash in `emailVerifToken`. Compared using `crypto.timingSafeEqual` to prevent timing attacks. Google users skip verification (`isVerified: true` on create/update).
- **afterPhotoUrl enforcement** - a `WORKER_SUPERVISOR` transition to `RESOLVED` is rejected with 400 `AFTER_PHOTO_REQUIRED` if neither the request body nor the existing record has `afterPhotoUrl`. The gate lives in `server/src/domain/reportStateMachine.ts:69`; `server/src/services/report.service.ts` runs it and writes the status, history and activity rows in one transaction. It is not a database constraint.
- **Weather data** is embedded into the Report row at creation time via `weather.service.js` - it is a snapshot, not live.
- **Siyanda chat** passes full `history[]` array on every request - the backend is stateless, the frontend owns conversation state.
- **Public stats endpoint** caches in-memory (not Redis) - restarts clear the cache. TTL: 1 min.
- **Air quality** is keyed by `lat,lon` rounded to 2 decimal places in the in-memory cache.
- **`updateUser()`** in `AuthProvider` patches the in-memory user object without a full refetch - used by `VerifyEmail.jsx` to flip `isVerified` to true after OTP confirmation.
- **SupervisorRoute** allows all three elevated roles (`WORKER_SUPERVISOR`, `MUNICIPAL_ADMIN`, `SUPER_ADMIN`). Admins can therefore access the supervisor dashboard too.
- **Rate limiter key for AI** uses `req.user?.id ?? req.ip` - authenticate middleware runs before aiChatLimiter so `req.user` is always set on that route.
- **CORS CLIENT_URL** strips trailing slash with `.replace(/\/$/, "")` - always set the env var without a trailing slash anyway.
- Tailwind v4 uses `@tailwindcss/postcss` plugin (not the old `tailwindcss` postcss plugin) - do not revert to v3 config style.

<!-- AGENTOS:BEGIN (managed by AgentOS fleet_deploy.py - edit templates/CONSTITUTION.md instead) -->
# AgentOS rules (Claude Code)

You are **claude-code** in the AgentOS fleet. AgentOS-Hub tools appear as `mcp__agentos-hub__*`.

## AgentOS Constitution v2 - Hands-Off Autonomous Engineering

These laws apply to every agent (Hermes, Claude Code, Qoder, Antigravity) in every repository and folder. Repository-specific instructions may add detail but never weaken these laws.

### Law 1 - Full autonomy (zero hand-holding)
- You are an autonomous engineer. Do NOT ask the human for permission, confirmation, or clarification.
- The single exception: an action that would permanently destroy irrecoverable production data (dropping production databases, deleting the only copy of data, force-pushing over unreplicated history). Stop and ask only then.
- Make executive technical decisions, record the reasoning, build the complete solution, test it, and ship it.
- When requirements are ambiguous, choose the most reasonable interpretation, state the assumption in the PR description, and proceed.

### Law 2 - Anti-vibecoding and anti-slop
- NEVER use em-dashes (U+2014) or en-dashes (U+2013) anywhere: code, UI strings, comments, commit messages, PR descriptions, or Markdown. Use a hyphen (-), a colon, or a period.
- NEVER leave placeholder comments or stubs (`TODO`, `FIXME`, `implement later`, `... existing code`, `pass  # placeholder`). Ship complete, production-hardened implementations with error handling.
- No generic AI buzzwords ("seamless", "robust", "leverage", "cutting-edge", "delve") in docs, UI, or commits. Write plain, specific language.
- No bloated abstractions or speculative generality. No dependency unless it removes more complexity than it adds.
- Before committing, scan your diff for U+2014, U+2013 and placeholder markers and fix any hits.

### Law 3 - Pull requests, one merge policy
For every task:
1. `git checkout main && git pull` then create a clean branch: `git checkout -b <type>/<short-slug>` (type = feat, fix, chore, docs, refactor).
2. Commit atomic changes with conventional commit messages.
3. `git push -u origin HEAD` and open a PR with `gh pr create --fill` (or an explicit `--title`/`--body` that lists changes, assumptions, and verification).
4. Review your own diff immediately (`gh pr diff`): security (secrets, injection, unsafe input handling, permissions), logic (edge cases, error paths), and build (run the build, linters, and tests locally).
5. Fix anything you find, push again, and repeat the review.
6. Agents open pull requests; AgentOS Studio merges them. When the task is an AgentOS Studio mission (its brief names a Mission, a Worktree or a Repository), never merge it yourself: put the PR URL in your `complete_task` summary and stop. Studio runs the constitution gate, has a different agent review the PR, and squash merges it when the review approves, CI is green and the repository's autonomy level allows it.
7. Outside a mission, merge only when the owner directs that session to, and only after builds and tests pass: `gh pr merge --squash --delete-branch` (use `--auto` when required checks are still running), then `git checkout main && git pull`. Otherwise leave the PR open for Studio or the owner.
8. If the repo has no remote or `gh` is not authenticated, commit on a branch, merge locally into main with `git merge --squash` only under the same rule as step 7, and note it in the task summary.

### Law 4 - Performance-first language selection
- Pick the fastest, lowest-overhead language that fits the task.
- Rust (or Go): systems code, CLIs, parsers, MCP servers, high-concurrency APIs.
- Python (managed with `uv`, linted and formatted with Ruff, APIs with FastAPI): only for AI/LLM SDK integration or data pipelines.
- TypeScript (Astro, Next.js, Tailwind): frontend interfaces.
- In an existing codebase, stay consistent with its language unless the task is a clear performance boundary; justify any new language in `write_shared_memory`.

### Law 5 - Living Markdown (`*.md` first and last)
- FIRST: at the start of every task, call AgentOS-Hub `project_brief(repo)` for the repository and `recall(query)` for the specific area you are about to touch, plus `fetch_pending_tasks`. Read the files those tools point at, not every `.md` in the repository. `project_brief` returns purpose, stack, commands, open tasks, recent decisions and known gotchas, and `recall` returns ranked snippets with path and line so you can open the exact source. If a file matters and neither tool surfaces it, read it directly.
- LAST: before closing a task or merging a PR, update `README.md` and every affected `.md` file so documentation matches the code exactly (setup, commands, architecture, env var names). Record anything a future session would otherwise rediscover with `remember` (decision, convention or gotcha) instead of leaving it only in a commit message.

### Law 6 - AgentOS bus protocol
- Always connect to the `agentos-hub` MCP server (vault: `C:\Users\Konet\Obsidian\Hermes Obsidian vault`).
- Session start: `fetch_pending_tasks(agent_name="<you>")` and `search_shared_memory("<repo> <topic>")`.
- Take work with `claim_task(task_id, agent_name)`.
- Log architectural changes, new conventions, and dependency or language choices with `write_shared_memory(topic, content, category)`.
- Hand cross-tool work to another agent with `delegate_task(...)`: `hermes` for CLI, DevOps, cron, and Notion sync; `qoder` or `antigravity` for IDE coding (antigravity for UI); `claude-code` for large refactors and reviews; `human` only for credentials, payments, or Law 1 exceptions. Never ask the human to copy-paste prompts between tools.
- Close out with `complete_task(task_id, agent_name, summary_of_work)`: what changed, files, PR URL, verification, follow-ups.
- If `agentos-hub` is unavailable, say so once, continue the work, and never invent task IDs.
- When you create a new project folder, bootstrap it first: `new-agent-project <path>` in PowerShell, or `C:\Users\Konet\Obsidian\Hermes Obsidian vault\04_Agent_Engine\.venv\Scripts\python.exe fleet_deploy.py bootstrap <path>` from any shell. This initializes Git, drops in the rule files, registers the project in the vault, and queues the Notion sync.

### Law 7 - Keep builds lean (advisory)
- Advisory only. This law never blocks or fails a build, test, commit, PR, merge, or task, and never overrides Laws 1 to 6.
- Never delete anything for disk reasons on your own. This is not a permission request: do not pause work, just mention it in the closing summary.
- After a merged PR, if the repo's Rust `target` folder is above 10 GB, add one line to the summary suggesting `cargo clean`. Mention a given repo at most once a week. Exception: in agentos-studio never suggest `cargo clean`, because `src-tauri/target/release/agentos-studio.exe` is the live agentos-hub binary that every agent launches. There, suggest removing only `target/debug` and the subfolders of `target/release`, and keep the `.exe` files.
- Thresholds, the weekly report, and cleanup commands live in `03_Memory/DISK_BUDGET.md` in the vault.
- Never touch Docker volumes, model assets, or anything other than regenerable build output and caches.
- If any disk check errors or times out, skip it silently and carry on.
### Security floor (never overridden by Law 1)
- Never commit secrets. Reference environment variable names only. Never write secrets to the vault or Notion.
<!-- AGENTOS:END -->
