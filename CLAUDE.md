# CLAUDE.md — MuniSolve ZA Project Context

This file is the authoritative reference for Claude Code in this repository. Read this before asking questions or exploring the codebase.

---

## What This Project Is

MuniSolve ZA is a South African civic-tech platform. Citizens report municipal infrastructure failures (potholes, power outages, water leaks, etc.) and track resolution progress. Admins manage reports and users through a back-office dashboard. Supervisors triage and assign reports to maintenance crews. An embedded AI assistant called **Siyanda** (powered by Anthropic Claude) guides citizens through the reporting process.

**Owner:** Kone Tshivhinda — Full-Stack Developer, Johannesburg, SA  
**Email:** erictshivhinda@gmail.com  
**Status:** Production-deployed, portfolio project.

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
│   │   │   ├── AdminRoute.jsx        # Role guard — MUNICIPAL_ADMIN/SUPER_ADMIN only
│   │   │   ├── SupervisorRoute.jsx   # Role guard — WORKER_SUPERVISOR/MUNICIPAL_ADMIN/SUPER_ADMIN
│   │   │   ├── ProtectedRoute.jsx    # Auth guard — redirects to /login
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
└── server/                   # Express.js backend
    ├── prisma/
    │   └── schema.prisma             # Single source of truth for DB schema
    └── src/
        ├── config/
        │   └── db.config.js          # Prisma client singleton
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── report.controller.js
        │   ├── ai.controller.js
        │   ├── admin.controller.js
        │   ├── supervisor.controller.js
        │   └── public.controller.js
        ├── middleware/
        │   ├── auth.middleware.js             # JWT verify → sets req.user
        │   ├── authz.middleware.js            # Role checks
        │   ├── requireAdmin.middleware.js     # MUNICIPAL_ADMIN | SUPER_ADMIN
        │   ├── requireSupervisor.middleware.js# WORKER_SUPERVISOR | MUNICIPAL_ADMIN | SUPER_ADMIN
        │   ├── rateLimit.middleware.js        # All rate limiters
        │   ├── security.config.js
        │   └── validation.middleware.js
        ├── routes/
        │   ├── auth.routes.js
        │   ├── report.routes.js
        │   ├── ai.routes.js
        │   ├── admin.routes.js
        │   ├── supervisor.routes.js
        │   ├── public.routes.js
        │   └── user.routes.js
        ├── services/
        │   ├── weather.service.js    # Called at report submission time
        │   └── email.service.js      # Resend — sends branded OTP verification emails
        └── server.js                 # Entry point — middleware wiring, route mounting
```

---

## Tech Stack (exact versions)

| | |
|---|---|
| **Node.js** | 18+ |
| **Express** | 4.x |
| **Prisma** | 6.x (see server/package.json) |
| **Database** | PostgreSQL via Neon (serverless) |
| **React** | 19.2 |
| **Vite** | 7.x |
| **Tailwind CSS** | 4.x (PostCSS plugin: `@tailwindcss/postcss`) |
| **React Router** | 7.x |
| **Leaflet** | 1.9 + react-leaflet 5 + leaflet.heat 0.2 |
| **Axios** | 1.x |
| **Lucide React** | 0.564 (icons) |
| **Google OAuth** | `@react-oauth/google` 0.13 (active — `GoogleOAuthProvider` in `main.jsx`) |
| **JWT** | `jsonwebtoken` |
| **bcrypt** | `bcryptjs` (12 salt rounds) |
| **Helmet** | express-rate-limit + helmet |
| **Resend** | `resend` npm package — transactional email for OTP verification |
| **AI** | `@anthropic-ai/sdk` (Claude model, Siyanda) |

---

## Database Schema (Prisma)

> **Schema management:** `prisma db push` is used (not `prisma migrate dev`) because the DB was initially set up without Prisma migration history. Always use `npx prisma db push` for schema changes.

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
  emailVerifToken   String?       // SHA-256 hash of OTP — never stored plaintext
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
POST   /register             Public + authLimiter      — create account; sends OTP email; returns JWT
POST   /login                Public + authLimiter      — returns JWT
POST   /google               Public + authLimiter      — Google OAuth (body: { idToken }); returns JWT
POST   /send-verification    Public + emailVerifLimiter— resend OTP (body: { email })
POST   /verify-email         Public + emailVerifLimiter— verify OTP (body: { email, otp })
GET    /me                   Private                   — current user profile
POST   /logout               Private                   — logs activity, stateless
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

### Admin `/api/admin`  *(auth + requireAdmin — MUNICIPAL_ADMIN or SUPER_ADMIN)*
```
GET    /dashboard                   aggregate stats
GET    /reports                     all reports
GET    /reports/:id                 single
PATCH  /reports/:id/status          update status (valid: PENDING|ASSIGNED|IN_PROGRESS|RESOLVED|REJECTED|CLOSED)
DELETE /reports/:id

GET    /users                       all users
GET    /users/:id                   single
PATCH  /users/:id/status            activate/deactivate
PATCH  /users/:id/role              change role (valid: CITIZEN|MUNICIPAL_ADMIN|SUPER_ADMIN|WORKER_SUPERVISOR)
DELETE /users/:id

GET    /activity-logs               full audit trail
```

### Supervisor `/api/supervisor`  *(auth + requireSupervisor — WORKER_SUPERVISOR | MUNICIPAL_ADMIN | SUPER_ADMIN)*
```
GET    /dashboard                       stats (pending, assigned, inProgress, resolved, closed, teams)
GET    /reports/triage                  PENDING reports, oldest-first
GET    /reports/active                  ASSIGNED + IN_PROGRESS reports
GET    /reports/:id                     single report (includes team relation)
PATCH  /reports/:id/assign              body: { teamId, note? } — sets ASSIGNED + assignedAt
PATCH  /reports/:id/status             body: { status, afterPhotoUrl?, note? }
                                        RESOLVED requires afterPhotoUrl (enforced server-side)
GET    /reports/:id/suggestions         proximity + specialization-matched team list for a report
GET    /teams                           all teams with activeTickets count
POST   /teams                           create team (body: { name, specialization, municipality?, latitude?, longitude? })
PATCH  /teams/:id                       update team
```

### Public `/api/public`  *(no auth, cached)*
```
GET    /stats             1-min cache  — totalReports, pending, inProgress, resolved, rejected,
                                         resolutionRate, municipalitiesServed, categories[], topMunicipalities[]
GET    /air-quality?lat=&lon=         30-min cache — Open-Meteo API (keyless)
GET    /holidays                      24-hr cache  — Nager.Date SA holidays (keyless)
```

---

## Frontend Routes

```
/                 LandingPage          Public
/about            About                Public
/register         Register             Public
/login            Login                Public
/verify-email     VerifyEmail          Public  — OTP input; email passed via router state or useAuth
/dashboard        Dashboard            ProtectedRoute  — amber banner shown if !user.isVerified
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
| Google OAuth | `google-auth-library` verifyIdToken; findUnique+update/create (not upsert — avoids unique constraint conflicts); Google users auto-verified |
| Email OTP | 6-digit code; stored as SHA-256 hash; 15-min expiry; compared with `crypto.timingSafeEqual` |
| RBAC | `role` field on User; `requireAdmin` for admin routes; `requireSupervisor` for ops routes |
| Rate limits | Auth: 5/15min · General: 100/15min · AI: 30/hr (userId) · Email OTP: 5/hr (IP) |
| Headers | Helmet.js (CSP, HSTS, XSS, X-Frame-Options) |
| CORS | Strict allowlist: `localhost:5173` + `CLIENT_URL` env var |
| Proxy trust | `app.set('trust proxy', 1)` — Render sits behind a proxy |
| Activity log | Every auth event + all report/team/role changes written to ActivityLog |

---

## Supervisor Workflow — Status State Machine

```
PENDING → ASSIGNED    (supervisor assigns to a Team via /assign)
ASSIGNED → IN_PROGRESS (supervisor/crew starts work)
IN_PROGRESS → RESOLVED (requires afterPhotoUrl — enforced in supervisor.controller.js)
RESOLVED → CLOSED      (supervisor closes ticket)
Any state → REJECTED   (supervisor rejects)
```

Proximity matching in `getTeamSuggestions`: Haversine distance + category→specialization keyword scoring. Teams sorted by `specScore * 10 + muniMatch * 5 - distanceKm`.

---

## Environment Variables

### Server (`server/.env`)
```
DATABASE_URL=          # Neon PostgreSQL connection string
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
VITE_GOOGLE_CLIENT_ID=     # Same value as server GOOGLE_CLIENT_ID — needed by @react-oauth/google
```

---

## Development Commands

```bash
# Backend
cd server
npm install
npx prisma db push          # sync schema to Neon (DO NOT use prisma migrate dev)
npx prisma studio           # visual DB browser
npm run dev                 # nodemon watch

# Frontend
cd client
npm install
npm run dev                 # Vite dev server → http://localhost:5173
npm run build               # production build
npm run lint                # ESLint
```

---

## Deployment

| Service | What | Key config |
|---|---|---|
| **Render** | Express API | All server env vars set; `trust proxy 1` already set |
| **Vercel** | React SPA | `vercel.json` rewrites all paths to `index.html`; `VITE_GOOGLE_CLIENT_ID` must be set |
| **Neon** | PostgreSQL | Serverless; `DATABASE_URL` in Render env |
| **Resend** | Transactional email | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in Render env |
| **Google Cloud** | OAuth | Authorized JS origins must include both `localhost:5173` and the Vercel production URL |

---

## Key Patterns & Gotchas

- **Prisma client** is a singleton in `server/src/config/db.config.js` — always import from there, never instantiate a new `PrismaClient`.
- **Schema changes** — always use `npx prisma db push`, never `prisma migrate dev`. Migration history is not in sync with the Neon DB.
- **Roles** — the actual role strings are `CITIZEN`, `MUNICIPAL_ADMIN`, `SUPER_ADMIN`, `WORKER_SUPERVISOR`. The old CLAUDE.md incorrectly said `ADMIN`/`SUPERADMIN` — those are wrong.
- **Google OAuth** — uses explicit `findUnique` + `update/create` instead of `upsert`. The upsert caused Prisma "invalid invocation" errors due to dual unique fields (`email` + `googleId`). Do not revert to upsert.
- **Google JWT payload** — signed as `{ userId, email, role }`. The `googleLogin` handler previously used `{ id }` which broke `auth.middleware.js` (reads `decoded.userId`). Fixed.
- **Email OTP** — stored as a SHA-256 hash in `emailVerifToken`. Compared using `crypto.timingSafeEqual` to prevent timing attacks. Google users skip verification (`isVerified: true` on create/update).
- **afterPhotoUrl enforcement** — the `/supervisor/reports/:id/status` endpoint blocks `RESOLVED` if neither the request body nor the existing record has `afterPhotoUrl`. This is enforced in `supervisor.controller.js`, not at the DB level.
- **Weather data** is embedded into the Report row at creation time via `weather.service.js` — it is a snapshot, not live.
- **Siyanda chat** passes full `history[]` array on every request — the backend is stateless, the frontend owns conversation state.
- **Public stats endpoint** caches in-memory (not Redis) — restarts clear the cache. TTL: 1 min.
- **Air quality** is keyed by `lat,lon` rounded to 2 decimal places in the in-memory cache.
- **`updateUser()`** in `AuthProvider` patches the in-memory user object without a full refetch — used by `VerifyEmail.jsx` to flip `isVerified` to true after OTP confirmation.
- **SupervisorRoute** allows all three elevated roles (`WORKER_SUPERVISOR`, `MUNICIPAL_ADMIN`, `SUPER_ADMIN`). Admins can therefore access the supervisor dashboard too.
- **Rate limiter key for AI** uses `req.user?.id ?? req.ip` — authenticate middleware runs before aiChatLimiter so `req.user` is always set on that route.
- **CORS CLIENT_URL** strips trailing slash with `.replace(/\/$/, "")` — always set the env var without a trailing slash anyway.
- Tailwind v4 uses `@tailwindcss/postcss` plugin (not the old `tailwindcss` postcss plugin) — do not revert to v3 config style.
