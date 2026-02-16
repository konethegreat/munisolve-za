# MuniSolve ZA 🇿🇦

**A Security-First Municipal Service Delivery Platform for South Africa**

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Status](https://img.shields.io/badge/Status-Active_Development-yellow.svg)]()

---

## Project Overview

MuniSolve ZA is a comprehensive web application designed to bridge the communication gap between South African citizens and their local municipalities. Citizens can report service delivery issues (potholes, water leaks, electricity outages) and track their resolution in real-time, while municipal officials manage and resolve these issues efficiently.

**Current Status:** Backend API Complete | Frontend In Development 🚧

---

## What's Been Built (Backend - COMPLETE)

### **Completed Features**

#### **1. Enterprise-Grade Security Architecture**
- **JWT Authentication** - Secure token-based authentication with 24-hour expiry
- **Password Hashing** - bcrypt with salt rounds (12) for secure password storage
- **Role-Based Access Control (RBAC)** - Three-tier permission system (CITIZEN, MUNICIPAL_ADMIN, SUPER_ADMIN)
- **Rate Limiting** - DDoS protection with tiered limits:
  - Authentication: 5 attempts per 15 minutes
  - General API: 100 requests per 15 minutes
  - Report Creation: 10 reports per hour
- **Input Validation & Sanitization** - XSS and SQL injection prevention
- **Security Headers** - Helmet.js configured (CSP, HSTS, XSS Protection)
- **CORS Configuration** - Secure cross-origin resource sharing
- **Activity Logging** - Complete audit trail for security compliance

#### **2. Database Architecture**
- ✅ **PostgreSQL Database** - Production-ready relational database
- ✅ **Prisma ORM** - Type-safe database queries with migration system
- ✅ **Database Models**:
  - User (authentication & profiles)
  - Report (service delivery issues)
  - ActivityLog (security audit trail)
- ✅ **Relationships & Constraints** - Foreign keys, cascade deletes, unique constraints

#### **3. RESTful API Endpoints**

**Authentication Routes** (`/api/auth`)
```
POST   /register          - Create new user account
POST   /login             - Authenticate and get JWT token
GET    /me                - Get current user profile
POST   /logout            - Logout and log activity
```

**Report Routes** (`/api/reports`) - *Placeholders ready for implementation*
```
GET    /                  - Get all reports (with filters)
POST   /                  - Create new report
GET    /:id               - Get single report
PUT    /:id               - Update report
DELETE /:id               - Delete report (admin only)
```

**User Management Routes** (`/api/users`) - *Placeholders ready*
```
GET    /                  - Get all users (super admin)
GET    /:id               - Get user by ID
PUT    /:id               - Update user
DELETE /:id               - Delete user
```

**Public Routes** (`/api/public`)
```
GET    /dashboard         - Public statistics
GET    /municipalities    - List municipalities
```

#### **4. Middleware Stack**

**Security Middleware** (`/src/middleware`)
- ✅ `auth.middleware.js` - JWT verification (376 lines, heavily commented)
- ✅ `authz.middleware.js` - Role-based authorization (437 lines)
- ✅ `validation.middleware.js` - Input validation with express-validator (499 lines)
- ✅ `rateLimit.middleware.js` - Rate limiting for different endpoints (462 lines)
- ✅ `security.config.js` - Helmet & CORS configuration (426 lines)

**All middleware files include:**
- Line-by-line comments explaining security decisions
- Error handling with helpful messages
- Development vs production configurations
- Usage examples

#### **5. Controllers & Business Logic**
- ✅ `auth.controller.js` - User registration, login, session management (436 lines)
- Complete error handling
- Security logging
- Password verification
- Token generation

#### **6. Documentation**
- ✅ `README.md` - This file
- ✅ `SETUP_GUIDE.md` - Complete installation instructions
- ✅ `TESTING_GUIDE.md` - Step-by-step testing procedures
- ✅ `FILE_PLACEMENT.md` - Directory structure reference
- ✅ All code files heavily commented (explaining WHY, not just WHAT)

---

## 🛠️ Technology Stack

### **Backend** (COMPLETE)
```
Runtime:        Node.js 18+
Framework:      Express.js 4.18+
Database:       PostgreSQL 14+
ORM:            Prisma 6.19.2
Authentication: JWT (jsonwebtoken)
Security:       Helmet.js, bcrypt, express-rate-limit
Validation:     express-validator
Environment:    dotenv
```

### **Frontend** (PLANNED)
```
Framework:      React 18+
Build Tool:     Vite
Styling:        Tailwind CSS
HTTP Client:    Axios
Routing:        React Router DOM
Icons:          Lucide React
```

---

## 🔒 Security Features (Production-Ready)

### **Authentication & Authorization**
✅ JWT tokens with configurable expiry  
✅ Secure password hashing (bcrypt, 12 rounds)  
✅ Role-based access control (RBAC)  
✅ Session management  
✅ Token verification on every protected route  

### **Input Security**
✅ XSS prevention via input sanitization  
✅ SQL injection protection (Prisma parameterized queries)  
✅ Path traversal prevention  
✅ Email validation with disposable email blocking  
✅ Password strength requirements (8+ chars, uppercase, lowercase, number, special char)  

### **Network Security**
✅ Rate limiting on all endpoints  
✅ CORS with whitelist  
✅ Helmet.js security headers  
✅ HSTS for HTTPS enforcement (production)  
✅ Content Security Policy (CSP)  

### **Monitoring & Compliance**
✅ Activity logging for all user actions  
✅ Failed login attempt tracking  
✅ IP address and user agent logging  
✅ Complete audit trail  

---

## 📁 Project Structure

```
munisolve-za/
├── server/                          # Backend (COMPLETE ✅)
│   ├── src/
│   │   ├── controllers/
│   │   │   └── auth.controller.js   # Authentication logic
│   │   ├── routes/
│   │   │   ├── auth.routes.js       # Auth endpoints
│   │   │   ├── report.routes.js     # Report endpoints (placeholder)
│   │   │   ├── user.routes.js       # User management (placeholder)
│   │   │   └── public.routes.js     # Public endpoints (placeholder)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js   # JWT verification
│   │   │   ├── authz.middleware.js  # RBAC
│   │   │   ├── validation.middleware.js
│   │   │   ├── rateLimit.middleware.js
│   │   │   └── security.config.js   # Helmet & CORS
│   │   ├── config/
│   │   │   └── db.config.js         # Prisma client
│   │   └── server.js                # Application entry point
│   ├── prisma/
│   │   └── schema.prisma            # Database schema
│   ├── .env                         # Environment variables (NOT in git)
│   ├── .gitignore
│   └── package.json
│
├── client/                          # Frontend (PLANNED 🚧)
│   └── (to be implemented)
│
├── docs/                            # Documentation
│   ├── SETUP_GUIDE.md
│   ├── TESTING_GUIDE.md
│   └── API_DOCUMENTATION.md
│
├── README.md                        # This file
├── LICENSE                          # Proprietary license
└── .gitignore
```

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/))
- Git ([Download](https://git-scm.com/))

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/munisolve-za.git
   cd munisolve-za/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Create .env file
   cp .env.example .env
   
   # Edit .env with your settings:
   # - DATABASE_URL
   # - JWT_SECRET (use a strong random string)
   # - PORT (default: 5000)
   ```

4. **Setup database**
   ```bash
   # Create database
   psql -U postgres -c "CREATE DATABASE munisolve_za;"
   
   # Run migrations
   npx prisma migrate dev --name init
   
   # (Optional) Open Prisma Studio
   npx prisma studio
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

Server runs at: `http://localhost:5000`

---

## 🧪 Testing

### **Test Authentication Endpoints**

```bash
# 1. Health check
curl http://localhost:5000/health

# 2. Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Thabo",
    "lastName": "Mbeki",
    "email": "thabo@example.com",
    "password": "SecurePass123!",
    "phone": "0123456789"
  }'

# 3. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "thabo@example.com",
    "password": "SecurePass123!"
  }'

# 4. Get current user (use token from login)
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**See `TESTING_GUIDE.md` for comprehensive testing procedures.**

---

## 📊 Current Metrics

**Code Statistics:**
- Total Backend Files: 15+
- Lines of Code: ~5,000+ (excluding node_modules)
- Comments: ~2,000+ lines (40% comment ratio)
- Security Middleware: 2,200+ lines
- Test Coverage: Manual testing complete

**Security Features:**
- Authentication Endpoints: 4
- Authorization Roles: 3
- Rate Limiters: 5
- Validation Rules: 50+
- Security Headers: 8+

---

## 🎯 Roadmap

### **Phase 1: Backend API** ✅ COMPLETE
- [x] User authentication system
- [x] Security middleware stack
- [x] Database schema
- [x] Activity logging
- [x] API structure

### **Phase 2: Report Management** 🚧 IN PROGRESS
- [ ] Report CRUD operations
- [ ] Image upload functionality
- [ ] Municipality and ward management
- [ ] Status workflow (Pending → In Progress → Resolved)
- [ ] Assignment system

### **Phase 3: Frontend Development** 📋 PLANNED
- [ ] React application setup
- [ ] Citizen portal
- [ ] Admin dashboard
- [ ] Public transparency dashboard
- [ ] Authentication UI

### **Phase 4: Advanced Features** 📋 PLANNED
- [ ] Email notifications
- [ ] SMS integration
- [ ] Real-time updates (WebSockets)
- [ ] Analytics dashboard
- [ ] Mobile app (React Native)

### **Phase 5: Production Deployment** 📋 PLANNED
- [ ] AWS/Azure deployment
- [ ] SSL/TLS certificates
- [ ] CI/CD pipeline
- [ ] Monitoring and logging
- [ ] Backup strategy

---

## 🏆 Technical Highlights

### **What Makes This Project Stand Out**

1. **Security-First Approach**
   - Every security decision is documented
   - Defense in depth strategy
   - Production-ready security stack
   - OWASP best practices followed

2. **Code Quality**
   - Extensive inline documentation
   - Clean architecture (MVC pattern)
   - Error handling on every endpoint
   - Consistent coding standards

3. **Scalability**
   - Modular structure
   - Separation of concerns
   - Database migrations system
   - Environment-based configuration

4. **South African Context**
   - Local terminology (Ward Councillors, Load-shedding)
   - South African phone number validation
   - Municipality-specific features
   - Addresses real local problems

---

## 👨‍💻 Developer

**Kone Tshivhinda**  
Full-Stack Developer | Johannesburg, South Africa

- 📧 Email: erictshivhinda@gmail.com
- 💼 LinkedIn: [\[your profile\]](https://za.linkedin.com/in/kone-tshivhinda-32a760233)
- 🌐 Portfolio: [\[your website\]](https://github.com/konethegreat)
- 📍 Location: Johannesburg, Gauteng, ZA

**Available for hire** - Open to full-time, contract, or freelance opportunities.

---

## 📄 License & Usage

**This is proprietary software available for portfolio review only.**

### ✅ PERMITTED:
- Viewing code for employment consideration
- Code review for educational purposes
- Evaluating technical skills

### ❌ PROHIBITED:
- Commercial use without written permission
- Redistribution or copying
- Creating derivative works
- Using in your own projects

**Commercial Licensing Available** - Contact: [your email]

---

## 🤝 Contributing

This is a proprietary project. However, if you're interested in collaborating or have suggestions:

1. **Employers:** Contact me for code walkthrough
2. **Collaborators:** Reach out to discuss partnership
3. **Ideas:** Open an issue for feature suggestions

---

## 📞 Contact & Support

**For Employment Opportunities:**  
📧 erictshivhinda@gmail.com 
💼 [\[LinkedIn profile\]](https://za.linkedin.com/in/kone-tshivhinda-32a760233)  

**For Licensing Inquiries:**  
📧 erictshivhinda@gmail.com 
📄 See LICENSE file for details

**For Technical Questions:**  
📧 erictshivhinda@gmail.com
🐛 Open an issue (employers only)

---

## 🙏 Acknowledgments

- **Anthropic Claude** - AI assistance for code generation and architecture guidance
- **South African Municipalities** - Inspiration for addressing real community needs
- **Open Source Community** - For the excellent tools and libraries used

---

## 📈 Project Timeline

- **January 2026** - Concept development and research
- **February 2026** - Backend architecture and security implementation
- **February 15, 2026** - Backend API completion ✅
- **Q1 2026** - Frontend development (planned)
- **Q2 2026** - Production deployment (planned)

---

**© 2026 Kone tshivhinda. All Rights Reserved.**

*Built with ❤️ in South Africa 🇿🇦*
*Yes the read me was made with an AI nobody has the time to write this stuff anymore*