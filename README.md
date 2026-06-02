# MuniSolve ZA

**Enterprise Municipal Service Delivery Platform for South Africa**

MuniSolve ZA is a full-stack civic-tech platform that bridges the gap between South African citizens and local government. Citizens can report infrastructure failures and utility outages, track resolution progress in real time, and get instant guidance from an AI assistant — while municipal administrators manage reports, users, and activity through a secure back-office dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18+ · Express.js |
| **Database** | PostgreSQL (Neon Serverless) · Prisma ORM |
| **Frontend** | React 19 · Vite · Tailwind CSS 4 |
| **Routing** | React Router v7 |
| **Mapping** | Leaflet · React-Leaflet · leaflet.heat |
| **AI** | Anthropic Claude (Siyanda assistant) |
| **Auth** | JWT · bcrypt · Google OAuth 2.0 |
| **HTTP Client** | Axios (interceptors, base URL config) |
| **Security** | Helmet.js · express-rate-limit · CORS |
| **Deployment** | Vercel (frontend) · Render (backend) · Neon (database) |

---

## Features

### Citizen Portal
- **Fault Reporting** — Submit geo-tagged reports with title, description, category, municipality, and street address. Weather conditions (temperature, rainfall, wind, humidity) are automatically embedded at submission time.
- **Report Dashboard** — Citizens see only their own reports with live status badges: `PENDING` → `IN_PROGRESS` → `RESOLVED`.
- **Incident Map** — Interactive Leaflet heatmap showing all active incidents across municipalities. Clickable markers link to full report details.
- **Siyanda AI Chat** — Per-report conversational assistant powered by Anthropic Claude. Guides citizens through the reporting process, explains municipal procedures, and validates input. Rate-limited to 30 messages per hour per user.
- **Live Public Widgets** — Landing page shows real-time community stats, air quality (Open-Meteo), and upcoming South African public holidays (Nager.Date API) — all without authentication.

### Admin Back-Office
- **Dashboard** — Aggregate statistics: total reports, open incidents, resolved count, registered users.
- **Report Management** — View all reports across all municipalities, update statuses, and delete invalid submissions.
- **User Management** — View all registered users, activate/deactivate accounts, promote or demote roles (`CITIZEN` → `ADMIN` → `SUPERADMIN`).
- **Activity Logs** — Full audit trail of all significant system events (registrations, logins, report submissions) with IP address and user-agent capture.

### Security Architecture
- **JWT Authentication** — Stateless, 24-hour expiring tokens. Middleware validates every protected route.
- **Role-Based Access Control** — Three-tier permission model: `CITIZEN`, `ADMIN`, `SUPERADMIN`. Admin routes enforce `requireAdmin` middleware.
- **Rate Limiting** — Layered limits: 5 auth attempts per 15 min (brute-force protection), 100 API calls per 15 min (general), 30 AI chat messages per hour (cost control). Auth limiter skips successful requests.
- **Password Security** — bcrypt with 12 salt rounds.
- **Security Headers** — Helmet.js enforces CSP, HSTS, X-Frame-Options, and XSS protection.
- **CORS** — Strict origin allowlist matching Vercel deployment URL and local dev.

---

## Data Models

```
User
├── id, email (unique), password (hashed)
├── firstName, lastName, phone?
├── googleId? (OAuth)
├── role: CITIZEN | ADMIN | SUPERADMIN
├── isActive, isVerified, lastLogin
└── relations: reports[], activityLogs[]

Report
├── id, title, description, category
├── municipality, address?, latitude?, longitude?
├── status: PENDING | IN_PROGRESS | RESOLVED
├── weatherTemp?, weatherCondition?, weatherRainfall?
├── weatherWind?, weatherHumidity?
└── relation: user

ActivityLog
├── id, userId, action, entity, entityId
├── description?, ipAddress?, userAgent?
└── relation: user
```

---

## API Reference

### Auth — `/api/auth`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register with email + password |
| `POST` | `/login` | Public | Login, returns JWT |
| `GET` | `/me` | Private | Get authenticated user profile |

### Reports — `/api/reports`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/` | Private | Submit a new fault report |
| `GET` | `/` | Private | List reports (citizen: own; admin: all) |
| `GET` | `/:id` | Private | Get a single report |
| `PUT` | `/:id` | Private | Edit a report |
| `PATCH` | `/:id/status` | Private | Update report status |
| `DELETE` | `/:id` | Private | Delete a report |

### AI — `/api/ai`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/chat` | Private | Chat with Siyanda (body: `reportId`, `message`, `history[]`) |

### Admin — `/api/admin`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/dashboard` | Admin | Aggregate platform statistics |
| `GET` | `/reports` | Admin | All reports |
| `GET` | `/reports/:id` | Admin | Single report detail |
| `PATCH` | `/reports/:id/status` | Admin | Update report status |
| `DELETE` | `/reports/:id` | Admin | Delete report |
| `GET` | `/users` | Admin | All users |
| `GET` | `/users/:id` | Admin | Single user detail |
| `PATCH` | `/users/:id/status` | Admin | Activate / deactivate user |
| `PATCH` | `/users/:id/role` | Admin | Change user role |
| `DELETE` | `/users/:id` | Admin | Delete user |
| `GET` | `/activity-logs` | Admin | Full audit log |

### Public — `/api/public`
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/stats` | Public | Aggregate community statistics |
| `GET` | `/air-quality` | Public | Live air quality index (Open-Meteo) |
| `GET` | `/holidays` | Public | Upcoming SA public holidays (Nager.Date) |

---

## Local Development

**Prerequisites:** Node.js 18+, PostgreSQL or a Neon database URL.

```bash
# 1. Clone
git clone https://github.com/konethegreat/munisolve-za.git
cd munisolve-za

# 2. Backend
cd server
npm install
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, CLIENT_URL
npx prisma migrate dev
npm run dev

# 3. Frontend (new terminal)
cd client
npm install
cp .env.example .env          # fill in VITE_API_URL
npm run dev
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:5000`.

---

## Deployment

| Service | Purpose | URL |
|---|---|---|
| **Vercel** | React frontend | Production |
| **Render** | Express API | Production |
| **Neon** | PostgreSQL (serverless) | Production |

Environment variables required on Render: `DATABASE_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`, `CLIENT_URL`.  
Environment variables required on Vercel: `VITE_API_URL`.

---

## Project Status

| Component | Status |
|---|---|
| API & Database | Production |
| Authentication & RBAC | Production |
| Fault Reporting | Production |
| Siyanda AI Chat | Production |
| Admin Dashboard | Production |
| Interactive Map | Production |
| Public Widgets | Production |

---

## Developer

**Kone Tshivhinda** — Full-Stack Developer, Johannesburg, South Africa

- [LinkedIn](https://za.linkedin.com/in/kone-tshivhinda-32a760233)
- [erictshivhinda@gmail.com](mailto:erictshivhinda@gmail.com)
- Open to Full-Stack, Backend, or Security-focused roles

---

© 2026 Kone Tshivhinda. All rights reserved. Proprietary software — for portfolio evaluation.
