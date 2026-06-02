# CLAUDE.md — MuniSolve ZA Project Context

This file is the authoritative reference for Claude Code in this repository. Read this before asking questions or exploring the codebase.

---

## What This Project Is

MuniSolve ZA is a South African civic-tech platform. Citizens report municipal infrastructure failures (potholes, power outages, water leaks, etc.) and track resolution progress. Admins manage reports and users through a back-office dashboard. An embedded AI assistant called **Siyanda** (powered by Anthropic Claude) guides citizens through the reporting process.

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
│   │   │   ├── axios.js          # Axios instance (base URL + auth interceptor)
│   │   │   └── publicApi.js      # Keyless public API calls
│   │   ├── components/
│   │   │   ├── AdminRoute.jsx    # Role guard — ADMIN/SUPERADMIN only
│   │   │   ├── ProtectedRoute.jsx# Auth guard — redirects to /login
│   │   │   ├── SiyandaChat.jsx   # AI chat panel (per-report)
│   │   │   ├── IncidentMap.jsx   # Leaflet heatmap component
│   │   │   ├── ReportCard.jsx    # Report list item
│   │   │   ├── WeatherBadge.jsx  # Inline weather display
│   │   │   ├── AirQualityBadge.jsx
│   │   │   ├── HolidayBanner.jsx
│   │   │   ├── StatsSection.jsx  # Animated counters for landing page
│   │   │   ├── AnimatedCounter.jsx
│   │   │   ├── Hero.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── MunicipalitySelector.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # React context shape
│   │   │   └── AuthProvider.jsx  # JWT decode, user state, login/logout helpers
│   │   ├── hooks/
│   │   │   └── useAuth.js        # Consumes AuthContext
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx   # Public home (stats, air quality, holiday banner)
│   │   │   ├── About.jsx
│   │   │   ├── Login.jsx         # Email/password + Google OAuth button
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx     # Citizen's report list
│   │   │   ├── ReportFault.jsx   # Report submission form
│   │   │   ├── ReportDetail.jsx  # Single report + Siyanda chat
│   │   │   ├── MapPage.jsx       # Leaflet heatmap full page
│   │   │   └── Admin.jsx         # Admin back-office (tabs: reports, users, logs)
│   │   ├── utils/
│   │   │   └── mapUtils.js
│   │   ├── App.jsx               # Route definitions
│   │   └── main.jsx
│   ├── vite.config.js
│   └── vercel.json               # SPA rewrite rules for Vercel
│
└── server/                   # Express.js backend
    ├── prisma/
    │   └── schema.prisma         # Single source of truth for DB schema
    └── src/
        ├── config/
        │   └── db.config.js      # Prisma client singleton
        ├── controllers/
        │   ├── auth.controller.js
        │   ├── report.controller.js
        │   ├── ai.controller.js
        │   ├── admin.controller.js
        │   └── public.controller.js
        ├── middleware/
        │   ├── auth.middleware.js       # JWT verify → sets req.user
        │   ├── authz.middleware.js      # Role checks
        │   ├── requireAdmin.middleware.js # Shorthand for ADMIN/SUPERADMIN
        │   ├── rateLimit.middleware.js  # All rate limiters (see below)
        │   ├── security.config.js
        │   └── validation.middleware.js
        ├── routes/
        │   ├── auth.routes.js
        │   ├── report.routes.js
        │   ├── ai.routes.js
        │   ├── admin.routes.js
        │   ├── public.routes.js
        │   └── user.routes.js
        ├── services/
        │   └── weather.service.js  # Called at report submission time
        └── server.js               # Entry point — middleware wiring, route mounting
```

---

## Tech Stack (exact versions)

| | |
|---|---|
| **Node.js** | 18+ |
| **Express** | 4.x |
| **Prisma** | latest (see server/package.json) |
| **Database** | PostgreSQL via Neon (serverless) |
| **React** | 19.2 |
| **Vite** | 7.x |
| **Tailwind CSS** | 4.x (PostCSS plugin: `@tailwindcss/postcss`) |
| **React Router** | 7.x |
| **Leaflet** | 1.9 + react-leaflet 5 + leaflet.heat 0.2 |
| **Axios** | 1.x |
| **Lucide React** | 0.564 (icons) |
| **Google OAuth** | `@react-oauth/google` 0.13 |
| **JWT** | `jsonwebtoken` |
| **bcrypt** | `bcryptjs` (12 salt rounds) |
| **Helmet** | express-rate-limit + helmet |
| **AI** | `@anthropic-ai/sdk` (Claude model, Siyanda) |

---

## Database Schema (Prisma)

```prisma
model User {
  id           Int           @id @default(autoincrement())
  email        String        @unique
  password     String        // bcrypt hash; empty string for Google-only accounts
  firstName    String
  lastName     String
  googleId     String?       @unique
  phone        String?
  role         String        @default("CITIZEN")  // CITIZEN | ADMIN | SUPERADMIN
  isActive     Boolean       @default(true)
  isVerified   Boolean       @default(false)
  lastLogin    DateTime?
  createdAt    DateTime      @default(now())
  reports      Report[]
  activityLogs ActivityLog[]
}

model Report {
  id               Int      @id @default(autoincrement())
  title            String
  description      String
  category         String
  municipality     String
  address          String?
  latitude         Float?
  longitude        Float?
  status           String   @default("PENDING")  // PENDING | IN_PROGRESS | RESOLVED | REJECTED
  weatherTemp      Float?
  weatherCondition String?
  weatherRainfall  Float?
  weatherWind      Float?
  weatherHumidity  Float?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  userId           Int
  user             User     @relation(fields: [userId], references: [id])
}

model ActivityLog {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  action      String   // REGISTER | LOGIN | LOGIN_FAILED | LOGOUT | REPORT_CREATED | etc.
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
POST   /register          Public   — create account (firstName, lastName, email, password, phone?)
POST   /login             Public   — returns JWT
POST   /google            Public   — Google OAuth (body: { idToken })
GET    /me                Private  — current user profile
POST   /logout            Private  — logs activity, stateless (client drops token)
```

### Reports `/api/reports`  *(all require auth)*
```
POST   /                  create report
GET    /                  list (citizen: own; admin: all)
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

### Admin `/api/admin`  *(auth + requireAdmin — ADMIN or SUPERADMIN)*
```
GET    /dashboard                   aggregate stats
GET    /reports                     all reports
GET    /reports/:id                 single
PATCH  /reports/:id/status          update status
DELETE /reports/:id

GET    /users                       all users
GET    /users/:id                   single
PATCH  /users/:id/status            activate/deactivate
PATCH  /users/:id/role              change role
DELETE /users/:id

GET    /activity-logs               full audit trail
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
/                 LandingPage      Public
/about            About            Public
/register         Register         Public
/login            Login            Public
/dashboard        Dashboard        ProtectedRoute
/report           ReportFault      ProtectedRoute
/reports/:id      ReportDetail     ProtectedRoute
/map              MapPage          ProtectedRoute
/admin            Admin            AdminRoute (ADMIN | SUPERADMIN)
```

---

## Security Architecture

| Concern | Implementation |
|---|---|
| Auth | JWT, 24h expiry, `req.user` set by `auth.middleware.js` |
| Passwords | bcrypt, 12 salt rounds |
| Google OAuth | `google-auth-library` verifyIdToken, upsert on email |
| RBAC | `role` field on User; `requireAdmin` middleware for admin routes |
| Rate limits | Auth: 5/15min (skips successes) · General: 100/15min · AI: 30/hr (by userId) |
| Headers | Helmet.js (CSP, HSTS, XSS, X-Frame-Options) |
| CORS | Strict allowlist: `localhost:5173` + `CLIENT_URL` env var |
| Proxy trust | `app.set('trust proxy', 1)` — Render sits behind a proxy |
| Activity log | Every register/login/logout/failed-login written to ActivityLog |

---

## Environment Variables

### Server (`server/.env`)
```
DATABASE_URL=          # Neon PostgreSQL connection string
JWT_SECRET=            # Long random string
JWT_EXPIRES_IN=24h     # Optional, defaults to 24h
ANTHROPIC_API_KEY=     # Claude API key for Siyanda
GOOGLE_CLIENT_ID=      # Google OAuth client ID
CLIENT_URL=            # Vercel frontend URL (exact, no trailing slash)
NODE_ENV=              # development | production
PORT=5000              # Optional
```

### Client (`client/.env`)
```
VITE_API_URL=          # Render backend URL
```

---

## Development Commands

```bash
# Backend
cd server
npm install
npx prisma migrate dev      # run migrations
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
| **Render** | Express API | Env vars above; `trust proxy 1` already set |
| **Vercel** | React SPA | `vercel.json` rewrites all paths to `index.html` |
| **Neon** | PostgreSQL | Serverless; `DATABASE_URL` in Render env |

---

## Key Patterns & Gotchas

- **Prisma client** is a singleton in `server/src/config/db.config.js` — always import from there, never instantiate a new `PrismaClient`.
- **Weather data** is embedded into the Report row at creation time via `weather.service.js` — it is a snapshot, not live.
- **Google OAuth users** have an empty string for `password` and `phone: 'N/A'` — don't assume password is always set.
- **Siyanda chat** passes full `history[]` array on every request — the backend is stateless, the frontend owns conversation state.
- **Public stats endpoint** caches in-memory (not Redis) — restarts clear the cache. TTL: 1 min.
- **Air quality** is keyed by `lat,lon` rounded to 2 decimal places in the in-memory cache.
- **AdminRoute** vs **ProtectedRoute** — AdminRoute checks `role === 'ADMIN' || role === 'SUPERADMIN'`; ProtectedRoute only checks authentication.
- **Rate limiter key for AI** uses `req.user?.id ?? req.ip` — authenticate middleware runs before aiChatLimiter so `req.user` is always set on that route.
- **CORS CLIENT_URL** strips trailing slash with `.replace(/\/$/, "")` — always set the env var without a trailing slash anyway.
- Tailwind v4 uses `@tailwindcss/postcss` plugin (not the old `tailwindcss` postcss plugin) — do not revert to v3 config style.
