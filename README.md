# MuniSolve ZA
### Enterprise Municipal Service Delivery Platform

MuniSolve ZA is a full-stack digital infrastructure project designed to facilitate transparent communication between South African citizens and local government entities. The platform enables automated reporting of municipal service failures—such as infrastructure damage and utility outages—while providing a secure administrative backend for issue tracking and resolution.

---

## Technical Architecture

### Backend Core
- **Runtime:** Node.js 18+ with Express.js
- **Database:** PostgreSQL hosted via Neon (Serverless)
- **ORM:** Prisma for type-safe database transactions and schema management
- **AI Integration:** Anthropic Claude (Siyanda AI) for intelligent user assistance and report categorization

### Frontend Core
- **Framework:** React 18+ 
- **Build Tool:** Vite
- **State Management:** Hooks & Axios Interceptors
- **Deployment:** Vercel (Frontend) | Render (Backend)

---

## Implementation Highlights

### 1. Security & Identity Management
The system implements a multi-layered security strategy to protect citizen data and ensure system integrity:
- **JWT Authentication:** Stateless token-based sessions with 24-hour expiration.
- **Cryptographic Hashing:** Password protection using bcrypt with 12 salt rounds.
- **Role-Based Access Control (RBAC):** Permission tiers for Citizens, Municipal Administrators, and Super Admins.
- **Rate Limiting:** DDoS and brute-force protection across all authentication and API endpoints.
- **Security Headers:** Comprehensive Helmet.js integration for CSP, HSTS, and XSS protection.

### 2. Intelligent Reporting (Siyanda AI)
Integrating the Anthropic SDK allowed for the creation of "Siyanda," a contextual AI assistant that:
- Simplifies the technical reporting process for non-technical users.
- Validates user input before it reaches the database to ensure high-quality data.
- Provides real-time assistance regarding municipal procedures.

### 3. Production Pipeline
- **Environment Management:** Secure handling of secrets across development and production environments.
- **CORS Policy:** Strict origin-matching between Vercel and Render to prevent unauthorized cross-site requests.
- **Audit Trails:** Automatic logging of all significant user actions (Login, Registration, Report Creation) via a dedicated ActivityLog model.

---

## API Documentation Summary

### Authentication Endpoints
- `POST /api/auth/register` - New user onboarding with email validation.
- `POST /api/auth/login` - Secure credential verification and token issuance.
- `GET /api/auth/me` - Validated session profile retrieval.

### Reporting & AI
- `POST /api/reports` - Submission of municipal service delivery issues.
- `POST /api/ai/chat` - Interaction with the Siyanda AI integration.

---

## Project Status

- **Infrastructure:** Fully Deployed (Production Ready)
- **Database:** Migrations Finalized
- **AI Integration:** Active
- **Frontend Portal:** Active

---

## Developer Information

**Kone Tshivhinda** *Full-Stack Developer | Johannesburg, South Africa*

- **LinkedIn:** [Kone Tshivhinda](https://za.linkedin.com/in/kone-tshivhinda-32a760233)
- **Email:** erictshivhinda@gmail.com
- **Availability:** Open to Full-Stack, Backend, or Security-focused roles.

---
© 2026 Kone Tshivhinda. All rights reserved. Proprietary software for portfolio evaluation.