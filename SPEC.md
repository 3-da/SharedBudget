# Marriage Budget Tracker - Comprehensive Specification

**Document Version:** 1.3  
**Created:** January 28, 2026  
**Updated:** January 28, 2026 (Corrected & verified versions)  
**Project Status:** Ready for Development  
**Target Audience:** Claude Coder / Development Team

---

## 🎯 Technology Stack (Verified Latest Versions - January 28, 2026)

### Frontend
- **Framework:** React 19.2.4 ✅ (latest stable, released January 26, 2026)
- **Build Tool:** Vite 7.x (7.3.1 latest stable)
- **Language:** TypeScript 5.9.x (strict mode)
- **Styling:** TailwindCSS 4.1.x ✅ (4.1.18 latest stable)
- **UI Components:** Shadcn/UI (latest, with Base UI support - January 2026)
- **State Management:** React Hooks + Context API (simple, no Redux needed)
- **HTTP Client:** axios 1.7.x with interceptors
- **Form Handling:** React Hook Form 7.x + Zod validation
- **Date Handling:** date-fns 4.x (if needed for monthly tracking)
- **Development:** Vite 7 dev server with HMR

### Backend
- **Runtime:** Node.js 24.13.0 LTS (latest LTS, released October 2025, support until April 2028)
- **Framework:** NestJS 11.1.x ✅ (11.1.12 latest stable)
- **Language:** TypeScript 5.9.x (strict mode)
- **Database ORM:** Prisma 7.2.x ✅ (7.2.0 latest stable - **RUST-FREE, rewritten in TypeScript, FASTER!**)
- **API Documentation:** Swagger/OpenAPI (@nestjs/swagger)
- **Validation:** class-validator + class-transformer
- **Caching:** Redis 7.2.x with ioredis client
- **Authentication:** JWT (future enhancement, basic structure ready)
- **Environment Variables:** dotenv for configuration
- **Logging:** @nestjs/common built-in logger (expandable to Winston)
- **Testing:** Jest 30.x (unit + integration tests)

### Database
- **Primary:** PostgreSQL 18.1 ✅ (latest stable, released November 13, 2025)
  - Also supported: 17.7, 16.11, 15.15, 14.20, 13.23
- **ORM:** Prisma 7.2.x with Prisma Client
- **Migrations:** Prisma migrations (version controlled)
- **Connection Pooling:** Prisma connection management (or PgBouncer for production)
- **Seeding:** Prisma seed script for dev data

### Caching & Message Queue
- **Cache Layer:** Redis 7.2.x (latest stable)
- **Client Library:** ioredis 5.x (connection pooling, retry logic)
- **TTL Strategy:**
  - Salaries: 5 minutes
  - Summary calculations: 2 minutes
  - Expense lists: 1 minute
  - Settlement data: 2 minutes

### DevOps & Deployment
- **Containerization:** Docker 27.x + Docker Compose
- **Container Registry:** Docker Hub / GitHub Container Registry
- **CI/CD:** GitHub Actions
- **Code Quality:** ESLint + Prettier
- **Testing Coverage:** Jest with coverage reports
- **Database Migrations:** Automated via Prisma in CI/CD

### Development Tools
- **IDE:** WebStorm 2024.x or IntelliJ IDEA Ultimate 2024.x
- **Version Control:** Git + GitHub
- **Package Manager:** npm 11.x (or yarn/pnpm)
- **API Testing:** REST Client extension / Thunder Client
- **Database Client:** DataGrip or pgAdmin
- **Monitoring:** (Production: New Relic / Datadog foundation)

---

## 🏗️ Complete Feature Specification

### 1. Salary Management
- **Input:** Two separate salary profiles per person
  - Default monthly salary (baseline expectation)
  - Current monthly salary (actual this month)
- **Storage:** Real-time updates to database
- **Display:** Summary cards showing total household income
- **Validation:** Non-negative numbers only, format as EUR

### 2. Expense Tracking System

#### Default Monthly Expenses (Recurring)
- List of recurring monthly expenses (rent, utilities, subscriptions, etc.)
- Properties per expense:
  - Name (string, max 100 chars)
  - Amount (decimal €, non-negative)
  - `isAnnual` flag (if true, divide by 12 for display)
  - `isShared` flag (if true, 50/50 split with partner)
- **CRUD Operations:** Create, read, update, delete expenses
- **Persistence:** All expenses saved to PostgreSQL 18
- **Display:** Real-time calculation of totals

#### Current Month Expenses (One-Time)
- Non-recurring expenses for the current month only
- Properties per expense:
  - Name (string)
  - Amount (decimal €)
  - `isShared` flag
- **Purpose:** Temporary overages or special purchases
- **Clear Monthly:** Option to archive/clear at month-end
- **Display:** Separate from recurring expenses with red styling

### 3. Shared Expenses & Automatic Settlement
- **Automatic Calculation:**
  - Identify all expenses marked as `isShared: true`
  - Calculate each person's 50/50 contribution
  - Determine who owes whom
- **Settlement Logic:**
  - If total shared = €1,000, each person pays €500
  - System tracks who paid what via database
  - Calculates net settlement amount (person A owes person B €X)
- **Display:**
  - Detailed breakdown of all shared expenses
  - Clear settlement message: "Darijan needs to send you €XXX"
  - Real-time updates as expenses change

### 4. Financial Dashboard & Analytics
- **Summary Cards (4 total):**
  - Total Default Income (both salaries)
  - Total Current Income (both salaries this month)
  - Total Default Expenses (all recurring)
  - Total Current Expenses (all one-time)
- **Savings Cards (5 total):**
  - Ajla Default Savings: Income - Default Expenses
  - Ajla Current Savings: Current Income - All Expenses + Settlement
  - Darijan Default Savings: Income - Default Expenses
  - Darijan Current Savings: Current Income - All Expenses - Settlement
  - Combined Balance: Total household savings (highlighted)
- **Visual Indicators:**
  - Positive balances: Teal (#2db8c6)
  - Negative balances: Red (#c01527)
  - Annual expenses: Orange (#a84b2f)
  - Shared expenses: Red badge

### 5. User Experience
- **Responsive Design:** Mobile-first, works on phones/tablets/desktop
- **Real-Time Updates:** All calculations update instantly as values change
- **Intuitive Interface:** Clear sections for income, recurring, current, shared expenses
- **Visual Feedback:** Badges for annual expenses, shared expenses
- **Delete Operations:** Easy deletion of expenses with × button
- **Form Validation:** Required fields, positive numbers only, error messages
- **Accessibility:** WCAG 2.1 AA compliance

---

## 👥 User Stories (8 Total)

### User Story 1: Income Setup
**As a** newlywed couple  
**I want to** input both our salaries (default and current month)  
**So that** I can see total household income and plan accordingly

**Acceptance Criteria:**
- [ ] Each person has two salary input fields (default + current)
- [ ] Salary values display in EUR currency format
- [ ] Summary cards update in real-time as values change
- [ ] Invalid inputs (negative numbers) are rejected
- [ ] Values persist when page reloads
- [ ] Values stored in PostgreSQL 18

### User Story 2: Recurring Expense Management
**As a** household manager  
**I want to** add, edit, and delete monthly recurring expenses  
**So that** I can track our regular financial obligations

**Acceptance Criteria:**
- [ ] Can add new recurring expense with name, amount, annual flag, shared flag
- [ ] Expenses display in a list with delete button
- [ ] Annual expenses show "÷12" badge and calculate monthly equivalent
- [ ] Shared expenses show "50/50" red badge
- [ ] Total recurring expenses updates automatically
- [ ] Can delete any expense instantly
- [ ] All expenses persist in PostgreSQL 18 via Prisma 7

### User Story 3: One-Time Expense Tracking
**As a** budget conscious couple  
**I want to** track temporary month-specific expenses separately  
**So that** I can see the difference between normal and abnormal spending

**Acceptance Criteria:**
- [ ] Separate section for current month expenses
- [ ] Different color styling (red background) from recurring
- [ ] Can add/delete current expenses independently
- [ ] Current expenses don't carry over next month
- [ ] Include shared flag for 50/50 split tracking

### User Story 4: Automatic Debt Settlement
**As a** couple managing shared expenses  
**I want to** see automatically calculated settlement amounts  
**So that** I know exactly who owes whom without manual calculation

**Acceptance Criteria:**
- [ ] All `isShared: true` expenses identified automatically
- [ ] 50/50 split calculated for each shared expense
- [ ] Total settlement amount displayed clearly
- [ ] Settlement message shows: "Darijan needs to send you €XXX"
- [ ] Calculation updates instantly when expenses change
- [ ] Works for both default and current shared expenses
- [ ] Settlement data cached in Redis (2 min TTL)

### User Story 5: Financial Overview
**As a** couple planning our finances  
**I want to** see comprehensive savings and balance information  
**So that** I can make informed financial decisions

**Acceptance Criteria:**
- [ ] Individual savings cards for each person (default + current)
- [ ] Combined household balance card (highlighted, larger font)
- [ ] Negative balances display in red color
- [ ] Calculations account for settlement adjustments
- [ ] All values update in real-time
- [ ] Clear labels explain each calculation
- [ ] Responsive on mobile, tablet, desktop

### User Story 6: Data Persistence
**As a** user  
**I want to** have my financial data saved permanently  
**So that** I can access it anytime without re-entering information

**Acceptance Criteria:**
- [ ] All data stored in PostgreSQL 18 database
- [ ] Data persists after page refresh
- [ ] Backend validates all data before saving (Prisma 7)
- [ ] No data loss on browser crashes
- [ ] Can retrieve historical data (future enhancement)
- [ ] Automatic backups configured

### User Story 7: API Integration
**As a** full-stack developer  
**I want to** have RESTful API endpoints for all operations  
**So that** the frontend can communicate with the backend properly

**Acceptance Criteria:**
- [ ] 19 API endpoints implemented (see API Endpoints section)
- [ ] All endpoints use /api/v1 versioning
- [ ] Proper HTTP methods (GET, POST, PUT, DELETE)
- [ ] Swagger/OpenAPI documentation generated
- [ ] CORS properly configured
- [ ] Error responses consistent

### User Story 8: Caching & Performance
**As a** performance-conscious developer  
**I want to** cache frequently accessed data  
**So that** the app responds instantly and reduces database load

**Acceptance Criteria:**
- [ ] Salaries cached in Redis (5 min TTL)
- [ ] Summary calculations cached (2 min TTL)
- [ ] Expense lists cached (1 min TTL)
- [ ] Cache invalidated on any write operation
- [ ] API response times < 100ms for cached data
- [ ] Cache misses handled gracefully with fresh DB query

---

## 🔌 API Endpoints (19 Total)

### Salary Endpoints (3)
```
GET    /api/v1/salaries           - Get current salaries
POST   /api/v1/salaries           - Update salaries (both people)
GET    /api/v1/salaries/:month    - Get salaries for specific month
```

### Default Expense Endpoints (5)
```
GET    /api/v1/expenses/default           - List all default expenses
POST   /api/v1/expenses/default           - Create default expense
PUT    /api/v1/expenses/default/:id       - Update default expense
DELETE /api/v1/expenses/default/:id       - Delete default expense
GET    /api/v1/expenses/default/total     - Get total default expenses
```

### Current Expense Endpoints (5)
```
GET    /api/v1/expenses/current           - List current month expenses
POST   /api/v1/expenses/current           - Create current expense
PUT    /api/v1/expenses/current/:id       - Update current expense
DELETE /api/v1/expenses/current/:id       - Delete current expense
GET    /api/v1/expenses/current/total     - Get total current expenses
```

### Settlement Endpoints (3)
```
GET    /api/v1/settlement                 - Get current settlement
GET    /api/v1/settlement/:month/:year    - Get settlement for month
POST   /api/v1/settlement/mark-settled    - Mark settlement as paid
```

### Summary/Dashboard Endpoints (3)
```
GET    /api/v1/summary                    - Get complete financial summary
GET    /api/v1/summary/savings            - Get savings breakdown
GET    /api/v1/summary/expenses           - Get expense analysis
```

---

## 🐳 Docker & Containerization

### Services in docker-compose.yml
1. **PostgreSQL 18.1** (port 5432, alpine)
2. **Redis 7.2** (port 6379, alpine)
3. **Backend API - NestJS 11** (port 3000)
4. **Frontend - React 19 + Vite 7** (port 5173 dev, 3001 prod)

### Docker Images
- Frontend: node:24-alpine → build → nginx (production)
- Backend: node:24-alpine
- Database: postgres:18-alpine
- Cache: redis:7-alpine

---

## 🚀 CI/CD with GitHub Actions

### Workflows (5 Total)
1. **test.yml** - Lint, format, type-check, unit/integration tests on every PR
2. **docker-build.yml** - Build and push Docker images
3. **database-migration.yml** - Validate Prisma migrations
4. **deploy.yml** - Deploy to staging (future)
5. **code-quality.yml** - SonarQube, security scanning, dependency checks

### Test Execution
- Backend tests: Jest 30.x with PostgreSQL 18 + Redis 7
- Frontend tests: Jest 30.x with React 19.2
- Coverage targets: Backend >80%, Frontend >75%

---

## 🧪 Testing Strategy

### Unit Tests
- Backend: Expense calculations, salary validation, settlement logic
- Frontend: Component rendering, form validation, currency formatting

### Integration Tests
- API endpoints with real PostgreSQL 18 database
- Prisma 7 migrations
- Redis cache invalidation
- Multi-expense settlement calculations

### Test Coverage Targets
- Backend: >80% coverage
- Frontend: >75% coverage
- Critical paths: 100% coverage

---

## 📈 Performance Targets

### Frontend (React 19 + Vite 7 + TailwindCSS 4.1)
- Lighthouse Score: >90
- First Contentful Paint (FCP): <1.5s
- Largest Contentful Paint (LCP): <2.5s
- Time to Interactive: <2s
- Bundle Size: <250KB (gzipped)

### Backend (NestJS 11 + Prisma 7)
- API response time (cached): <50ms
- API response time (uncached): <200ms
- Database query time: <100ms (Prisma 7 is 3x faster with Rust-free architecture)
- 99th percentile latency: <500ms

### Database (PostgreSQL 18.1)
- Query execution: <100ms for all operations
- Connection pooling: 20-30 connections
- Indexes on all WHERE/JOIN columns

---

## ✅ Checklist for Development Completion

### Backend Setup
- [ ] NestJS 11.1.x project initialized
- [ ] PostgreSQL 18.1 configured with docker-compose
- [ ] Prisma 7.2.x schema created and migrations run
- [ ] Redis 7.2 configured for caching
- [ ] 19 API endpoints implemented
- [ ] Input validation with class-validator
- [ ] Error handling standardized
- [ ] Unit tests written (>80% coverage with Jest 30)
- [ ] Integration tests written
- [ ] Swagger/OpenAPI documentation generated
- [ ] GitHub Actions CI/CD configured

### Frontend Setup
- [ ] React 19.2.4 + Vite 7 project initialized
- [ ] TypeScript 5.9.x configured (strict mode)
- [ ] TailwindCSS 4.1.x configured
- [ ] Shadcn/UI components set up
- [ ] All pages/components created
- [ ] Form validation with React Hook Form + Zod
- [ ] API integration with axios
- [ ] Real-time calculations working
- [ ] Responsive design implemented
- [ ] Unit tests written (>75% coverage)
- [ ] Performance optimized (Lighthouse >90)

### DevOps & Deployment
- [ ] Docker 27 images for frontend and backend
- [ ] docker-compose.yml for local development (all 4 services)
- [ ] GitHub Actions workflows (5 total)
- [ ] Database migrations automated (Prisma 7)
- [ ] Code quality checks in CI/CD
- [ ] Security scanning (npm audit, Snyk)

### Portfolio Readiness
- [ ] GitHub repository public
- [ ] README.md with setup instructions
- [ ] Tech stack clearly documented (with latest versions!)
- [ ] Performance metrics included
- [ ] Screenshots/demo GIF included
- [ ] Live demo link (if deployed)

---

## 🎯 Why These Exact Versions Matter for Your Career

**You're using bleeding-edge stable software** that German tech companies are adopting RIGHT NOW:

✅ **React 19.2.4** - Latest stable (January 26, 2026)
✅ **TailwindCSS 4.1.x** - Up to 5x faster, modern CSS features
✅ **Shadcn/UI** - Base UI + Radix support, enterprise components
✅ **NestJS 11.1.x** - Stable, production-ready backend
✅ **Prisma 7.2.x** - Rust-free TypeScript rewrite, 3x faster queries
✅ **PostgreSQL 18.1** - Latest stable
✅ **Node.js 24 LTS** - Support until April 2028
✅ **Vite 7.x** - Latest stable build tool  

**Interview Impact:** "I'm using the latest stable versions as of January 2026" demonstrates you stay current with the ecosystem.

---

**Document Status:** ✅ VERIFIED WITH ACTUAL LATEST VERSIONS
**Ready for Development:** YES
**Latest Stack (Verified):** React 19.2.4 + Vite 7.3.1 + NestJS 11.1.12 + Prisma 7.2.0 + PostgreSQL 18.1 + Node.js 24 LTS + TypeScript 5.9.x
**Estimated Timeline:** 4-6 weeks for MVP, 8-10 weeks for production-ready
**Portfolio Value:** ⭐⭐⭐⭐⭐ Enterprise-grade, cutting-edge stack

---

*Document corrected and verified January 28, 2026 with actual latest versions from GitHub, NPM, and official release notes.*
