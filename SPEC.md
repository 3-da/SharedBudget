# Household Budget Tracker — Feature Specification

**Document Version:** 3.0
**Created:** January 28, 2026
**Updated:** January 31, 2026 (Synced with implemented codebase state)
**Project Status:** Phase 1 — Auth & Household implemented, Expenses & Dashboard pending

> **Related docs:**
> - `ARCHITECTURE.md` — Tech stack, data model, infrastructure, caching, Docker, CI/CD
> - `CLAUDE.md` — Development process rules for Claude Code

---

## Core Concepts

### Users
Every person using the app has their own account with email/password authentication. Each user has their own salary and personal expenses that only they can manage.

### Households
A household groups users who share a budget. After registering and verifying their email, a user can either **create a new household** (gets an 8-char invite code) or **join an existing household** via two methods:
- **Invite code:** Enter the code directly — instant join, no approval needed
- **Email invitation:** Household owner invites by email — target user accepts or declines

Phase 1 supports max 2 members (couple). Phase 2 will support unlimited members (roommates, etc.).

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

## Feature Specification

### 1. Authentication & User Management ✅
- **Registration:** Email + password + first name + last name
  - Registration is separate from household management (user first registers, then creates/joins a household)
  - Password requirements: min 8 chars, max 72 chars
  - Email must be unique
  - Returns generic message (enumeration prevention — never reveals if email exists)
- **Login:** Email + password → returns JWT access token + refresh token
  - Requires email to be verified first (403 if not verified)
- **Token Management:**
  - Access token: 15-minute expiry, sent in Authorization header
  - Refresh token: 7-day expiry, stored in Redis with session tracking
  - Refresh token rotation: old token invalidated on each refresh
  - Auto-refresh on frontend via axios interceptor (planned)
- **Logout:** Invalidates the specific refresh token and removes from session set
- **Forgot Password:** Sends reset link via email (1-hour TTL token in Redis)
- **Reset Password:** Validates token, updates password, invalidates ALL user sessions
- **Profile:** User can view and update their name (not email) — *not yet implemented*
- **Password Change:** Requires current password + new password — *not yet implemented*

### 1.1 Email Verification Flow (6-Digit Code) ✅
When a user registers, their account is created but marked as **unverified**. They must verify via a 6-digit code before accessing the app.

**Registration Response:**
- Always returns: `{ message: "We've sent a verification code to your email." }`
- Never reveals whether the email already exists (security best practice)
- No tokens returned until email is verified

**Verification Process:**
1. User submits registration form (email, password, firstName, lastName)
2. Backend creates user with `emailVerified: false`
3. Backend generates 6-digit numeric code (e.g., "847293")
4. Code stored in Redis with key `verify:{email}`, TTL 10 minutes
5. Backend sends email: "Your verification code is: 847293"
6. Frontend shows code input screen: "Enter the 6-digit code we sent to {email}"
7. User enters code → Frontend calls `POST /api/v1/auth/verify-code`
8. Backend validates: code exists in Redis, code matches, code not expired
9. On success: Set `emailVerified: true`, delete code from Redis, return tokens (auto-login)
10. On failure: Return error "Invalid or expired code", user can request new code

**Resend Code:**
- Endpoint: `POST /api/v1/auth/resend-code`
- Input: `{ email: string }`
- Always returns: `{ message: "If an account exists, we've sent a new code." }`
- Rate limited: max 3 requests per email per 10 minutes
- Generates new code, invalidates old one
- Only works for unverified accounts

**Login Restriction:**
- Login checks `emailVerified` field
- If `false`: returns 403 with message: `"Please verify your email first. Check your inbox for the verification code."`

**Code Specifications:**
- Length: 6 digits (000000-999999)
- TTL: 10 minutes
- Storage: Redis (key: `verify:{email}`)
- Rate limit: Max 5 verification attempts per code

### 2. Household Management ✅
- **Create Household:** Post-registration (separate from auth flow)
  - Generates unique 8-character hex invite code
  - Creator becomes OWNER role
  - Phase 1: maxMembers = 2
  - User must not already be in a household
- **Join by Invite Code:** Enter 8-char code → instant join
  - Validates code exists and household has capacity
  - Joiner gets MEMBER role
  - No approval needed — the invite code IS the approval
- **Email Invitation Flow:** Owner invites a user by email
  - Validates: owner role, household not full, target user exists, target not in a household
  - Prevents duplicate pending invitations to same user
  - Target user receives email notification
  - Target can **accept** (joins household) or **decline** (invitation marked as declined)
  - Owner can **cancel** pending invitations
  - Target can view all their pending invitations
  - On accept: checks household still has room (race condition guard)
- **View Household:** See all members with names, roles, join dates
- **Regenerate Invite Code:** Only OWNER can regenerate (invalidates old code)
- **Leave Household:**
  - **Member:** Removes their membership
  - **Owner (alone):** Deletes the entire household (cascades invitations)
  - **Owner (with members):** Forbidden — must transfer ownership first
- **Remove Member:** Owner can remove any member (cannot remove self)
- **Transfer Ownership:** Owner transfers OWNER role to another member (atomic transaction)
  - Current owner becomes MEMBER, target becomes OWNER

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
  - If YEARLY: payment strategy (FULL or INSTALLMENTS) + details
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

## User Stories (13 Total)

### User Story 1: Registration & Email Verification ✅
**As a** new user
**I want to** register an account and verify my email
**So that** I can start using the app securely

**Acceptance Criteria:**
- [x] Registration form: email, password (8-72 chars), first name (1-50), last name (1-50)
- [x] Email uniqueness enforced (same response returned regardless — enumeration prevention)
- [x] 6-digit verification code sent to email (stored in Redis, 10-min TTL)
- [x] Verify code endpoint auto-logs in on success (returns JWT tokens)
- [x] Resend code endpoint (rate limited: 3 per 10 min)
- [x] Login blocked until email is verified (403)
- [ ] Frontend: registration form → code input screen → redirect to dashboard

### User Story 2: Login, Logout & Password Recovery ✅
**As a** registered user
**I want to** log in securely, stay authenticated, and recover my password if needed
**So that** my financial data is protected and accessible

**Acceptance Criteria:**
- [x] Login with email + password → JWT access token (15 min) + refresh token (7 days)
- [x] Login blocked if email not verified (403 with helpful message)
- [x] Refresh token rotation (old token invalidated, new one issued)
- [x] Logout invalidates specific refresh token
- [x] Forgot password → sends reset email with 1-hour token
- [x] Reset password → validates token, updates password, invalidates ALL sessions
- [x] All auth endpoints rate-limited (3-10 req/min depending on endpoint)
- [ ] Frontend: auto-refresh via axios interceptor
- [ ] Frontend: protected routes redirect to login if unauthenticated

### User Story 2.5: Household Management & Invitations ✅
**As a** verified user
**I want to** create a household, invite my partner, and manage membership
**So that** we can share a budget together

**Acceptance Criteria:**
- [x] Create household with name → get 8-char invite code, become OWNER
- [x] Join household instantly via invite code (MEMBER role)
- [x] Owner can invite users by email → email notification sent
- [x] Invited user can view pending invitations
- [x] Invited user can accept (joins household) or decline invitation
- [x] Owner can cancel pending invitations
- [x] View household with all members (names, roles, join dates)
- [x] Owner can regenerate invite code (invalidates old one)
- [x] Member can leave household
- [x] Owner can remove a member
- [x] Owner must transfer ownership before leaving (if household has members)
- [x] Owner can transfer OWNER role to another member (atomic transaction)
- [x] Household respects maxMembers constraint (Phase 1: 2)
- [x] Duplicate pending invitations prevented
- [x] Race condition guard on accept (household could be full)
- [ ] Frontend: household dashboard with member list and invite actions

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

## API Endpoints

### ✅ Authentication Endpoints (8 — all implemented)
```
POST   /api/v1/auth/register         - Register new user → sends 6-digit verification code  [3/min]
POST   /api/v1/auth/verify-code      - Verify email with 6-digit code → auto-login (tokens) [5/min]
POST   /api/v1/auth/resend-code      - Resend verification code                             [3/10min]
POST   /api/v1/auth/login            - Login with email + password (requires verified email) [5/min]
POST   /api/v1/auth/refresh          - Refresh access token (rotates refresh token)          [10/min]
POST   /api/v1/auth/logout           - Logout (invalidate refresh token)                     [10/min]
POST   /api/v1/auth/forgot-password  - Request password reset email (1-hour token)           [3/10min]
POST   /api/v1/auth/reset-password   - Reset password with token (invalidates all sessions)  [5/min]
```

### ✅ Household Endpoints (11 — all implemented)
All require `Authorization: Bearer <token>` header.

**CRUD:**
```
POST   /api/v1/household                       - Create new household (user must not be in one)    [5/min]
GET    /api/v1/household/mine                   - Get my household with all members                 [10/min]
POST   /api/v1/household/regenerate-code        - Generate new invite code (OWNER only)             [5/min]
```

**Invitations:**
```
POST   /api/v1/household/invite                 - Invite user by email (OWNER only)                 [5/min]
GET    /api/v1/household/invitations/pending     - Get my pending invitations                        [10/min]
POST   /api/v1/household/invitations/:id/respond - Accept or decline invitation                     [10/min]
DELETE /api/v1/household/invitations/:id         - Cancel pending invitation (sender only)           [5/min]
```

**Membership:**
```
POST   /api/v1/household/join                   - Join household by invite code (instant)            [5/min]
POST   /api/v1/household/leave                  - Leave household (see rules below)                  [5/min]
DELETE /api/v1/household/members/:userId         - Remove member (OWNER only, can't remove self)     [5/min]
POST   /api/v1/household/transfer-ownership      - Transfer OWNER role to another member             [5/min]
```

### 🔲 User Endpoints (3 — not yet implemented)
```
GET    /api/v1/users/me               - Get current user profile
PUT    /api/v1/users/me               - Update user profile (name only)
PUT    /api/v1/users/me/password      - Change password (requires current password)
```

### 🔲 Salary Endpoints (4 — not yet implemented)
```
GET    /api/v1/salaries/me                    - Get my salary (current month)
PUT    /api/v1/salaries/me                    - Update my salary (default + current)
GET    /api/v1/salaries/household             - Get all household members' salaries
GET    /api/v1/salaries/household/:year/:month - Get household salaries for specific month
```

### 🔲 Personal Expense Endpoints (5 — not yet implemented)
```
GET    /api/v1/expenses/personal              - List my personal expenses (with filters)
POST   /api/v1/expenses/personal              - Create personal expense
GET    /api/v1/expenses/personal/:id          - Get personal expense details
PUT    /api/v1/expenses/personal/:id          - Update personal expense (owner only)
DELETE /api/v1/expenses/personal/:id          - Delete personal expense (owner only)
```

### 🔲 Shared Expense Endpoints (4 — not yet implemented)
```
GET    /api/v1/expenses/shared                - List household shared expenses
GET    /api/v1/expenses/shared/:id            - Get shared expense details
POST   /api/v1/expenses/shared                - Propose new shared expense → creates approval
PUT    /api/v1/expenses/shared/:id            - Propose edit to shared expense → creates approval
DELETE /api/v1/expenses/shared/:id            - Propose deletion of shared expense → creates approval
```
**Note:** POST/PUT/DELETE on shared expenses don't directly modify data — they create approval requests.

### 🔲 Approval Endpoints (4 — not yet implemented)
```
GET    /api/v1/approvals                      - List pending approvals for current user
GET    /api/v1/approvals/history              - List past approvals (accepted/rejected)
PUT    /api/v1/approvals/:id/accept           - Accept a pending approval (with optional message)
PUT    /api/v1/approvals/:id/reject           - Reject a pending approval (with required message)
```

### 🔲 Dashboard / Summary Endpoints (4 — not yet implemented)
```
GET    /api/v1/dashboard                      - Complete household financial overview
GET    /api/v1/dashboard/savings              - Savings breakdown per member
GET    /api/v1/dashboard/settlement           - Current settlement calculation
POST   /api/v1/dashboard/settlement/mark-paid - Mark current month's settlement as paid
```

---

**Endpoint Summary:** 19 implemented (8 auth + 11 household) / 43 total planned
**Phase 1 Focus:** 2-person household (couple), full auth, expenses with approval workflow

*Split from original spec on January 29, 2026. Updated January 31, 2026.*
