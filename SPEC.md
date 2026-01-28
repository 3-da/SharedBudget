# Household Budget Tracker - Comprehensive Specification

**Document Version:** 2.0
**Created:** January 28, 2026
**Updated:** January 28, 2026 (Complete redesign with user auth, households & approval workflows)
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
- **HTTP Client:** axios 1.7.x with interceptors (JWT token handling)
- **Form Handling:** React Hook Form 7.x + Zod validation
- **Date Handling:** date-fns 4.x (monthly/yearly expense tracking)
- **Development:** Vite 7 dev server with HMR

### Backend
- **Runtime:** Node.js 24.13.0 LTS (latest LTS, released October 2025, support until April 2028)
- **Framework:** NestJS 11.1.x ✅ (11.1.12 latest stable)
- **Language:** TypeScript 5.9.x (strict mode)
- **Database ORM:** Prisma 7.2.x ✅ (7.2.0 latest stable - **RUST-FREE, rewritten in TypeScript, FASTER!**)
- **API Documentation:** Swagger/OpenAPI (@nestjs/swagger)
- **Validation:** class-validator + class-transformer
- **Caching:** Redis 7.2.x with ioredis client
- **Authentication:** JWT with @nestjs/jwt + @nestjs/passport + argon2 for password hashing
- **Environment Variables:** dotenv for configuration
- **Logging:** @nestjs/common built-in logger (expandable to Winston)
- **Testing:** Jest 30.x (unit + integration tests)

### Database
- **Primary:** PostgreSQL 18.1 ✅ (latest stable, released November 13, 2025)
- **ORM:** Prisma 7.2.x with Prisma Client
- **Migrations:** Prisma migrations (version controlled)
- **Connection Pooling:** Prisma connection management (or PgBouncer for production)
- **Seeding:** Prisma seed script for dev data

### Caching
- **Cache Layer:** Redis 7.2.x (latest stable)
- **Client Library:** ioredis 5.x (connection pooling, retry logic)
- **TTL Strategy:**
  - User sessions: 7 days (refresh tokens)
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

---

## 💡 Core Concepts

### Users
Every person using the app has their own account with email/password authentication. Each user has their own salary and personal expenses that only they can manage.

### Households
A household groups users who share a budget. When registering, a user either **creates a new household** (gets an invite code) or **joins an existing household** (enters an invite code). Phase 1 supports max 2 members (couple). Phase 2 will support unlimited members (roommates, etc.).

### Expense Types
- **Personal Expense:** Belongs to one user, only they can create/edit/delete it. Visible to all household members for budget calculations, but not editable by others.
- **Shared Expense:** Belongs to the household. Any member can propose creating, editing, or deleting shared expenses, but changes require **approval** from the other household member(s) before taking effect.

### Expense Frequency & Payment Options
- **Monthly:** Recurring every month, straightforward amount.
- **Yearly:** A total annual amount with flexible payment options:
  - **Pay in full:** Pay entire amount in a specific month. Specify who pays (one person or split among members).
  - **Split into installments:** Divide total by N (2 = semi-annual, 4 = quarterly, 12 = monthly). Each installment can be paid by one person or split among members.
  - For budget calculations, yearly expenses are always normalized to their **monthly equivalent** (total ÷ 12) regardless of payment strategy.

### Approval Workflow (Shared Expenses Only)
When a household member proposes a change to a shared expense (create, edit, or delete):
1. A **pending approval** is created
2. The other household member(s) are notified
3. Each reviewer can **accept** or **reject** with a short message
4. Only when **all members accept** does the change take effect
5. If **rejected**, the change is discarded and the rejection message is visible to the proposer

### Settlement
The system automatically calculates who owes whom based on shared expenses. Each person's share is computed, and a net settlement amount is displayed (e.g., "You owe Partner €125" or "Partner owes you €125").

---

## 🗄️ Data Model (Prisma Schema Overview)

### User
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | Unique, used for login |
| password | String | Argon2id hashed |
| firstName | String | Display name |
| lastName | String | Display name |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| deletedAt | DateTime? | Null = active. Non-null = soft-deleted (account deactivation) |

### Household
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | e.g., "The Smiths" |
| inviteCode | String | Unique 8-char code for joining |
| maxMembers | Int | Default 2 (Phase 1) |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

### HouseholdMember
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK → User |
| householdId | UUID | FK → Household |
| role | Enum | OWNER or MEMBER |
| joinedAt | DateTime | When user joined |

**Constraints:** Unique on (userId, householdId). A user can belong to only one household.

### Salary
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK → User |
| householdId | UUID | FK → Household |
| defaultAmount | Decimal | Baseline monthly salary |
| currentAmount | Decimal | Actual salary this month |
| month | Int | 1-12 |
| year | Int | e.g., 2026 |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Constraints:** Unique on (userId, month, year). Each user has one salary record per month.

### Expense
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| householdId | UUID | FK → Household |
| createdById | UUID | FK → User (who created it) |
| name | String | Max 100 chars |
| amount | Decimal | Total amount in EUR |
| type | Enum | PERSONAL or SHARED |
| category | Enum | RECURRING or ONE_TIME |
| frequency | Enum | MONTHLY or YEARLY |
| yearlyPaymentStrategy | Enum? | FULL or INSTALLMENTS (null if monthly) |
| installmentCount | Int? | 1, 2, 4, or 12 (null if monthly or FULL) |
| paymentMonth | Int? | 1-12, which month to pay in full (null if not FULL) |
| paidByUserId | UUID? | FK → User. Null = split among members |
| deletedAt | DateTime? | Null = active. Non-null = soft-deleted (with timestamp) |
| month | Int? | For ONE_TIME expenses: which month |
| year | Int? | For ONE_TIME expenses: which year |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Notes:**
- Personal expenses: `createdById` is the owner, only they can manage it
- Shared expenses: any household member can propose changes (goes through approval)
- ONE_TIME expenses have month/year to scope them; RECURRING expenses repeat every month
- `paidByUserId = null` means the cost is split equally among household members
- `paidByUserId = <userId>` means that specific person pays the full amount

### ExpenseApproval
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| expenseId | UUID? | FK → Expense (null for CREATE actions before expense exists) |
| householdId | UUID | FK → Household |
| action | Enum | CREATE, UPDATE, or DELETE |
| status | Enum | PENDING, ACCEPTED, or REJECTED |
| requestedById | UUID | FK → User (who proposed the change) |
| reviewedById | UUID? | FK → User (who reviewed) |
| message | String? | Reviewer's comment (e.g., "Too expensive this month") |
| proposedData | JSON? | For CREATE/UPDATE: the full proposed expense data |
| createdAt | DateTime | Auto-generated |
| reviewedAt | DateTime? | When review happened |

**Workflow:**
- CREATE: `proposedData` holds the full new expense. On accept → expense is created (with `deletedAt = null`).
- UPDATE: `proposedData` holds the changed fields. On accept → expense is updated.
- DELETE: No `proposedData` needed. On accept → expense is soft-deleted (`deletedAt` set to current timestamp).

---

## 🏗️ Complete Feature Specification

### 1. Authentication & User Management
- **Registration:** Email + password + first name + last name
  - During registration, user chooses: **Create new household** (enters household name) or **Join existing household** (enters invite code)
  - Password requirements: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
  - Email must be unique
- **Login:** Email + password → returns JWT access token + refresh token
- **Token Management:**
  - Access token: 15-minute expiry, sent in Authorization header
  - Refresh token: 7-day expiry, stored in httpOnly cookie
  - Auto-refresh on frontend via axios interceptor
- **Profile:** User can view and update their name (not email)
- **Password Change:** Requires current password + new password

### 1.1 Email Verification Flow
When a user registers, their account is created but marked as **unverified**. They must verify their email before they can log in.

**Registration Response:**
- Always returns: "We've sent a verification link to your email address."
- Never reveals whether the email already exists (security best practice)
- Same response whether registration succeeds or email is already taken

**Verification Process:**
1. User submits registration form (email, password, firstName, lastName)
2. Backend creates user with `emailVerified: false` and generates a verification token
3. Verification token: cryptographically secure random 32-byte hex string
4. Token stored in `emailVerificationToken` field, expires after 24 hours (`emailVerificationExpires`)
5. Backend sends email containing verification link: `{FRONTEND_URL}/auth/verify-email?token={token}`
6. User clicks link → frontend displays "Verifying..." and calls `POST /api/v1/auth/verify-email` with token
7. Backend validates token:
   - Token exists in database
   - Token has not expired (< 24 hours old)
   - Token has not been used already
8. On success:
   - Set `emailVerified: true`
   - Clear `emailVerificationToken` and `emailVerificationExpires` fields
   - Return success message
   - Frontend redirects to login page with success toast: "Email verified! You can now log in."
9. On failure:
   - Return appropriate error (expired, invalid, already used)
   - Frontend shows error with option to request new verification email

**Resend Verification Email:**
- Endpoint: `POST /api/v1/auth/resend-verification`
- Input: `{ email: string }`
- Always returns: "If an account exists with this email, we've sent a new verification link."
- Never reveals whether email exists in system
- Rate limited: maximum 3 requests per email per hour (prevents spam)
- Generates new token and invalidates the old one
- Only works for unverified accounts (silently succeeds for verified/non-existent)

**Login Restriction:**
- Login endpoint checks `emailVerified` field before allowing authentication
- If `emailVerified: false`: returns 403 Forbidden with message:
  "Please verify your email before logging in. Check your inbox or request a new verification email."
- Frontend shows this message with a "Resend verification email" button

**Database Changes (User model additions):**
| Field | Type | Notes |
|-------|------|-------|
| emailVerified | Boolean | Default `false`, set to `true` after successful verification |
| emailVerificationToken | String? | Random 32-byte hex string, `null` after verification |
| emailVerificationExpires | DateTime? | Token expiry timestamp (24h from creation), `null` after verification |

**New API Endpoints:**
```
POST   /api/v1/auth/verify-email        - Verify email with token → { token: string }
POST   /api/v1/auth/resend-verification - Resend verification email → { email: string }
```

**Email Template (Verification Email):**
- Subject: "Verify your email for SharedBudget"
- Body includes:
  - Greeting with user's first name
  - Clear call-to-action button: "Verify Email Address"
  - Link expiration notice (24 hours)
  - Note that they can ignore if they didn't register
  - Support contact information

**Security Considerations:**
- Tokens are single-use (cleared after verification)
- Tokens expire after 24 hours
- Rate limiting prevents enumeration attacks via resend endpoint
- Same response message regardless of email existence
- HTTPS required for all verification links

### 2. Household Management
- **Create Household:** During registration or post-registration
  - Generates unique 8-character invite code
  - Creator becomes OWNER role
  - Phase 1: maxMembers = 2
- **Join Household:** Enter invite code during registration or post-registration
  - Validates code exists and household has capacity
  - Joiner gets MEMBER role
  - Instantly joins (no approval needed — the invite code IS the approval)
- **View Household:** See all members, their names, roles
- **Regenerate Invite Code:** Only OWNER can regenerate (invalidates old code)
- **Leave Household:** A MEMBER can leave (future enhancement)

### 3. Salary Management
- **Per-User Salaries:** Each user manages their own salary
  - Default monthly salary (baseline expectation)
  - Current monthly salary (actual this month — can vary month to month)
- **Ownership:** Only the user can edit their own salary
- **Visibility:** All household members can view all salaries (needed for calculations)
- **Storage:** One salary record per user per month/year
- **Display:** Summary cards showing individual + total household income
- **Validation:** Non-negative numbers only, format as EUR (€)

### 4. Personal Expense Management
- **Ownership:** Each personal expense belongs to its creator
- **Permissions:** Only the owner can create, edit, or delete their personal expenses
- **Visibility:** All household members can see personal expenses (for budget overview), but cannot modify them
- **Properties:**
  - Name (string, max 100 chars)
  - Amount (decimal €, non-negative)
  - Category: RECURRING or ONE_TIME
  - Frequency: MONTHLY or YEARLY
  - If YEARLY: payment strategy (FULL or INSTALLMENTS) + details (see below)
- **Examples:** Gym membership, hairstyling, personal subscriptions, car expenses

### 5. Shared Expense Management (with Approval Workflow)
- **Ownership:** Belongs to the household, not any single user
- **Permissions:** Any household member can PROPOSE creating, editing, or deleting a shared expense
- **Approval Required:** Every proposed change creates a pending approval
  - Other member(s) see pending approvals in their dashboard/notifications
  - They can **accept** (with optional message) or **reject** (with required message explaining why)
  - Only accepted changes take effect
  - Rejected changes are logged with the rejection message
- **Splitting:** Shared expenses can be:
  - Split equally among all household members (default)
  - Assigned to one specific person to pay in full
- **Properties:** Same as personal expenses + splitting configuration
- **Examples:** Rent, electricity, internet, groceries, shared subscriptions (Netflix, Spotify)

### 6. Yearly Expense Payment Options
Yearly expenses (both personal and shared) support flexible payment strategies:

#### Option A: Pay in Full
- Specify which **month** the full amount is paid (1-12)
- Specify **who pays**: one person or split among members
- In budget calculations, amount is shown as the full amount in that specific month
- Monthly equivalent (÷12) shown in the overview for planning purposes

#### Option B: Split into Installments
- Choose number of installments: **2** (semi-annual), **4** (quarterly), or **12** (monthly)
- Each installment = total amount ÷ installment count
- Specify **who pays** each installment: one person or split among members
- Installments are spread evenly across the year
  - 2 installments: January & July
  - 4 installments: January, April, July, October
  - 12 installments: every month
- **Example:** €1,200 vacation
  - Full in June: €1,200 in June
  - 2 installments: €600 in January + €600 in July
  - 4 installments: €300 in Jan/Apr/Jul/Oct
  - 12 installments: €100 every month

### 7. Settlement Calculation
- **Automatic Calculation:**
  - Identify all shared expenses in the household
  - Calculate each person's fair share based on splitting rules
  - Determine net settlement: who owes whom and how much
- **Settlement Logic (Phase 1 - 2 people):**
  - Sum all shared expenses
  - For each: if split → each person's share = amount ÷ 2
  - If one person is assigned to pay → they owe the full amount
  - Net result: one person owes the other a specific amount
- **Display:**
  - Detailed breakdown of all shared expenses with individual shares
  - Clear settlement message: "You owe [Partner] €XXX" or "[Partner] owes you €XXX"
  - Updates in real-time as expenses change
- **Mark as Settled:** Button to mark current month's settlement as paid (audit trail)

### 8. Financial Dashboard & Analytics
- **Income Summary:**
  - Each member's default salary
  - Each member's current month salary
  - Total household income (default + current)
- **Expense Summary:**
  - Personal expenses per member (recurring + one-time, monthly equivalent)
  - Shared expenses (recurring + one-time, monthly equivalent)
  - Total household expenses
- **Savings per Member:**
  - Default savings = default salary − personal expenses − share of shared expenses
  - Current savings = current salary − all expenses this month (personal + shared share) ± settlement
- **Combined Household Balance:** Total savings across all members (highlighted card)
- **Pending Approvals Badge:** Shows count of pending approvals requiring attention
- **Visual Indicators:**
  - Positive balances: Teal (#2db8c6)
  - Negative balances: Red (#c01527)
  - Yearly expenses: Orange badge (#a84b2f)
  - Shared expenses: Shared badge
  - Pending approvals: Yellow badge

### 9. User Experience
- **Responsive Design:** Mobile-first, works on phones/tablets/desktop
- **Real-Time Updates:** All calculations update instantly as values change
- **Navigation:** Clear sections — Dashboard, My Expenses, Shared Expenses, Approvals, Salary, Settings
- **Approval Notifications:** Visual indicator (badge/dot) when pending approvals exist
- **Visual Feedback:** Badges for yearly expenses, shared expenses, approval status
- **Form Validation:** Required fields, positive numbers only, proper error messages
- **Auth Flow:** Login/Register pages, protected routes, auto-redirect
- **Accessibility:** WCAG 2.1 AA compliance

---

## 👥 User Stories (12 Total)

### User Story 1: Registration & Household Setup
**As a** new user
**I want to** register an account and either create or join a household
**So that** I can start tracking my household budget

**Acceptance Criteria:**
- [ ] Registration form: email, password, first name, last name
- [ ] Choice during registration: "Create new household" or "Join existing household"
- [ ] Create household: enter household name → receive invite code to share with partner
- [ ] Join household: enter 8-character invite code → instantly join
- [ ] Password validation: min 8 chars, 1 upper, 1 lower, 1 number
- [ ] Email uniqueness enforced
- [ ] After registration, redirect to dashboard
- [ ] Household invite code displayed prominently for sharing

### User Story 2: Login & Authentication
**As a** registered user
**I want to** log in securely and stay authenticated
**So that** my financial data is protected

**Acceptance Criteria:**
- [ ] Login form: email + password
- [ ] JWT access token (15 min) + refresh token (7 days)
- [ ] Auto-refresh via axios interceptor — seamless experience
- [ ] Protected routes redirect to login if unauthenticated
- [ ] Logout clears tokens
- [ ] Invalid credentials show clear error message

### User Story 3: Salary Management
**As a** household member
**I want to** set my own default and current monthly salary
**So that** the household income calculations are accurate

**Acceptance Criteria:**
- [ ] Each user has two salary fields: default (baseline) + current (this month)
- [ ] Only I can edit my own salary
- [ ] All household members can view all salaries
- [ ] Salary values display in EUR currency format
- [ ] Summary cards update in real-time
- [ ] Values persist per month/year in PostgreSQL via Prisma
- [ ] Invalid inputs (negative numbers) are rejected

### User Story 4: Personal Expense Management
**As a** household member
**I want to** manage my own personal recurring and one-time expenses
**So that** I can track spending that only I am responsible for

**Acceptance Criteria:**
- [ ] Can create expense with: name, amount, category (recurring/one-time), frequency (monthly/yearly)
- [ ] Yearly expenses: choose payment strategy (full in specific month, or installments of 2/4/12)
- [ ] Only I can edit/delete my personal expenses
- [ ] My partner can see my expenses (for household overview) but cannot modify them
- [ ] Expenses show appropriate badges (yearly, monthly equivalent)
- [ ] Total personal expenses auto-calculated
- [ ] One-time expenses scoped to a specific month/year

### User Story 5: Shared Expense Proposals
**As a** household member
**I want to** propose shared expenses that affect both of us
**So that** we can collaboratively manage our joint financial obligations

**Acceptance Criteria:**
- [ ] Can propose a new shared expense (name, amount, frequency, payment strategy, who pays/split)
- [ ] Proposal creates a PENDING approval — expense is NOT active yet
- [ ] Can propose editing an existing shared expense
- [ ] Can propose deleting an existing shared expense
- [ ] Pending proposals shown with yellow "Pending" badge
- [ ] My partner receives notification/badge about pending approval

### User Story 6: Expense Approval Workflow
**As a** household member
**I want to** review and approve or reject proposed shared expense changes
**So that** both partners agree on household spending

**Acceptance Criteria:**
- [ ] Dedicated "Approvals" section showing all pending proposals
- [ ] Each approval shows: what's proposed (create/edit/delete), proposed values, who proposed it
- [ ] Can ACCEPT with an optional message (e.g., "Looks good!")
- [ ] Can REJECT with a required message (e.g., "Too expensive this month, let's wait")
- [ ] Accepted proposals take effect immediately (expense created/updated/deleted)
- [ ] Rejected proposals are discarded; rejection reason visible to proposer
- [ ] Approval history viewable (past accepted/rejected items)

### User Story 7: Yearly Expense Configuration
**As a** household member
**I want to** configure how yearly expenses are paid
**So that** I can plan for large expenses flexibly

**Acceptance Criteria:**
- [ ] Choose "Pay in full": select month (1-12) + who pays (me, partner, or split)
- [ ] Choose "Installments": select count (2, 4, or 12) + who pays each installment
- [ ] Monthly equivalent always shown for budget planning (total ÷ 12)
- [ ] Example: €1,200 vacation → "€100/month" shown, actual payments per chosen schedule
- [ ] Works for both personal and shared yearly expenses
- [ ] Shared yearly expenses go through approval workflow

### User Story 8: Settlement & Debt Tracking
**As a** couple managing shared expenses
**I want to** see exactly who owes whom each month
**So that** we can settle debts fairly without manual calculation

**Acceptance Criteria:**
- [ ] All shared expenses calculated automatically
- [ ] Each person's share computed (50/50 for split, or full amount if assigned)
- [ ] Net settlement displayed: "You owe [Name] €XXX" or "[Name] owes you €XXX"
- [ ] Settlement updates instantly when shared expenses change
- [ ] "Mark as Settled" button to record when payment is made
- [ ] Historical settlements viewable per month
- [ ] Settlement data cached in Redis (2 min TTL)

### User Story 9: Financial Dashboard
**As a** household member
**I want to** see a comprehensive overview of our household finances
**So that** I can make informed financial decisions

**Acceptance Criteria:**
- [ ] Individual income cards for each member (default + current)
- [ ] Total household income card
- [ ] Personal expense totals per member
- [ ] Shared expense total with per-person shares
- [ ] Individual savings: income − personal expenses − shared expense share
- [ ] Combined household balance (highlighted, larger)
- [ ] Pending approvals count badge
- [ ] Negative balances in red, positive in teal
- [ ] Responsive on mobile, tablet, desktop

### User Story 10: Data Persistence & Security
**As a** user
**I want to** have my financial data saved securely
**So that** I can access it anytime and trust it's protected

**Acceptance Criteria:**
- [ ] All data stored in PostgreSQL 18 database
- [ ] Passwords hashed with Argon2id (recommended settings: memory 64MB, iterations 3, parallelism 1)
- [ ] JWT tokens for stateless authentication
- [ ] Data persists after page refresh
- [ ] Backend validates all data before saving (Prisma 7)
- [ ] Users can only access their own household's data
- [ ] API endpoints protected with auth guards

### User Story 11: API Integration
**As a** full-stack developer
**I want to** have RESTful API endpoints for all operations
**So that** the frontend can communicate with the backend properly

**Acceptance Criteria:**
- [ ] All endpoints implemented (see API Endpoints section)
- [ ] All endpoints use /api/v1 versioning
- [ ] Proper HTTP methods (GET, POST, PUT, PATCH, DELETE)
- [ ] Swagger/OpenAPI documentation generated
- [ ] CORS properly configured
- [ ] All non-auth endpoints protected with JWT guard
- [ ] Consistent error response format: { statusCode, message, error }

### User Story 12: Caching & Performance
**As a** performance-conscious developer
**I want to** cache frequently accessed data
**So that** the app responds instantly and reduces database load

**Acceptance Criteria:**
- [ ] Salaries cached in Redis (5 min TTL)
- [ ] Summary/dashboard calculations cached (2 min TTL)
- [ ] Expense lists cached (1 min TTL)
- [ ] Cache invalidated on any write operation for the household
- [ ] API response times < 100ms for cached data
- [ ] Cache misses handled gracefully with fresh DB query
- [ ] Cache keys scoped per household

---

## 🔌 API Endpoints (34 Total)

### Authentication Endpoints (6)
```
POST   /api/v1/auth/register            - Register new user → sends verification email
POST   /api/v1/auth/verify-email        - Verify email with token
POST   /api/v1/auth/resend-verification - Resend verification email (rate limited)
POST   /api/v1/auth/login               - Login with email + password → JWT tokens (requires verified email)
POST   /api/v1/auth/refresh             - Refresh access token using refresh token
POST   /api/v1/auth/logout              - Logout (invalidate refresh token)
```

### User Endpoints (3)
```
GET    /api/v1/users/me               - Get current user profile
PUT    /api/v1/users/me               - Update user profile (name only)
PUT    /api/v1/users/me/password      - Change password (requires current password)
```

### Household Endpoints (4)
```
GET    /api/v1/households/mine            - Get current user's household + members
POST   /api/v1/households                 - Create new household (if user has none)
POST   /api/v1/households/join            - Join household with invite code
POST   /api/v1/households/regenerate-code - Regenerate invite code (OWNER only)
```

### Salary Endpoints (4)
```
GET    /api/v1/salaries/me                    - Get my salary (current month)
PUT    /api/v1/salaries/me                    - Update my salary (default + current)
GET    /api/v1/salaries/household             - Get all household members' salaries
GET    /api/v1/salaries/household/:year/:month - Get household salaries for specific month
```

### Personal Expense Endpoints (5)
```
GET    /api/v1/expenses/personal              - List my personal expenses (with filters)
POST   /api/v1/expenses/personal              - Create personal expense
GET    /api/v1/expenses/personal/:id          - Get personal expense details
PUT    /api/v1/expenses/personal/:id          - Update personal expense (owner only)
DELETE /api/v1/expenses/personal/:id          - Delete personal expense (owner only)
```

### Shared Expense Endpoints (4)
```
GET    /api/v1/expenses/shared                - List household shared expenses
GET    /api/v1/expenses/shared/:id            - Get shared expense details
POST   /api/v1/expenses/shared                - Propose new shared expense → creates approval
PUT    /api/v1/expenses/shared/:id            - Propose edit to shared expense → creates approval
DELETE /api/v1/expenses/shared/:id            - Propose deletion of shared expense → creates approval
```
**Note:** POST/PUT/DELETE on shared expenses don't directly modify data — they create approval requests.

### Approval Endpoints (4)
```
GET    /api/v1/approvals                      - List pending approvals for current user
GET    /api/v1/approvals/history              - List past approvals (accepted/rejected)
PUT    /api/v1/approvals/:id/accept           - Accept a pending approval (with optional message)
PUT    /api/v1/approvals/:id/reject           - Reject a pending approval (with required message)
```

### Dashboard / Summary Endpoints (4)
```
GET    /api/v1/dashboard                      - Complete household financial overview
GET    /api/v1/dashboard/savings              - Savings breakdown per member
GET    /api/v1/dashboard/settlement           - Current settlement calculation
POST   /api/v1/dashboard/settlement/mark-paid - Mark current month's settlement as paid
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
- Backend: Auth logic, expense calculations, salary validation, settlement logic, approval workflow state machine
- Frontend: Component rendering, form validation, currency formatting, auth context

### Integration Tests
- API endpoints with real PostgreSQL 18 database
- Auth flow: register → login → refresh → access protected endpoint
- Approval workflow: propose → accept/reject → verify expense state
- Prisma 7 migrations
- Redis cache invalidation
- Multi-expense settlement calculations

### Test Coverage Targets
- Backend: >80% coverage
- Frontend: >75% coverage
- Critical paths (auth, approvals, settlement): 100% coverage

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
- Indexes on: userId, householdId, (userId + month + year), (householdId + type), (householdId + status)

---

## 📋 Development Phases

### Phase 1: Core MVP (Current Focus)
- ✅ Max 2 users per household (couple)
- ✅ User registration + login with JWT
- ✅ Household create/join with invite code
- ✅ Personal + shared expenses with full CRUD
- ✅ Approval workflow for shared expenses
- ✅ Monthly + yearly expense support with payment options
- ✅ Settlement calculation (50/50 or assigned)
- ✅ Financial dashboard with savings overview
- ✅ Redis caching
- ✅ Docker setup for all services

### Phase 2: Multi-Member Households (Future)
- 🔮 Support N members per household (roommates, family)
- 🔮 Custom split ratios (e.g., 60/40, proportional to income)
- 🔮 Role-based permissions (admin, member, viewer)
- 🔮 Expense categories and tags
- 🔮 Monthly/yearly reports and charts
- 🔮 Export to CSV/PDF
- 🔮 Push notifications for approvals
- 🔮 Multi-household support (user in multiple households)

---

## ✅ Checklist for Development Completion

### Backend Setup
- [ ] NestJS 11.1.x project initialized
- [ ] PostgreSQL 18.1 configured with docker-compose
- [ ] Prisma 7.2.x schema created with all 6 models
- [ ] Prisma migrations run and seed data created
- [ ] Redis 7.2 configured for caching + session storage
- [ ] JWT authentication module (register, login, refresh, logout)
- [ ] Auth guards on all protected endpoints
- [ ] User module (profile, password change)
- [ ] Household module (create, join, view members, regenerate code)
- [ ] Salary module (CRUD per user, household view)
- [ ] Personal expense module (CRUD with ownership enforcement)
- [ ] Shared expense module (proposals → approval workflow)
- [ ] Approval module (list, accept, reject, history)
- [ ] Dashboard module (summary, savings, settlement)
- [ ] 32 API endpoints implemented
- [ ] Input validation with class-validator
- [ ] Error handling standardized
- [ ] Unit tests written (>80% coverage with Jest 30)
- [ ] Integration tests written (auth flow, approval flow)
- [ ] Swagger/OpenAPI documentation generated

### Frontend Setup
- [ ] React 19.2.4 + Vite 7 project initialized
- [ ] TypeScript 5.9.x configured (strict mode)
- [ ] TailwindCSS 4.1.x configured
- [ ] Shadcn/UI components set up
- [ ] Auth pages: Login, Register (with create/join household flow)
- [ ] Dashboard page with summary cards
- [ ] My Expenses page (personal expense management)
- [ ] Shared Expenses page (proposals + active shared expenses)
- [ ] Approvals page (pending + history)
- [ ] Salary page (my salary + household view)
- [ ] Settings page (profile, household info, invite code)
- [ ] Auth context with JWT token management
- [ ] Axios interceptor for auto-refresh
- [ ] Protected route wrapper
- [ ] Form validation with React Hook Form + Zod
- [ ] Responsive design (mobile-first)
- [ ] Unit tests written (>75% coverage)
- [ ] Performance optimized (Lighthouse >90)

### DevOps & Deployment
- [ ] Docker 27 images for frontend and backend
- [ ] docker-compose.yml for local development (all 4 services)
- [ ] GitHub Actions workflows (5 total)
- [ ] Database migrations automated (Prisma 7)
- [ ] Code quality checks in CI/CD
- [ ] Security scanning (npm audit, Snyk)

---

**Document Status:** ✅ COMPLETE REDESIGN v2.0
**Ready for Development:** YES
**Stack:** React 19.2.4 + Vite 7.3.1 + NestJS 11.1.12 + Prisma 7.2.0 + PostgreSQL 18.1 + Redis 7.2 + Node.js 24 LTS + TypeScript 5.9.x
**Phase 1 Focus:** 2-person household (couple), full auth, expenses with approval workflow

---

*Document redesigned January 28, 2026. Previous v1.3 spec had no user system, no households, no approval workflow — completely replaced.*
