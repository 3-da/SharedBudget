# User Stories & Product Requirements

**Phase 1 scope** — household budget management for couples (2 members). Phase 2 will extend to multi-member households.

---

## Core Concepts

### Users & Households
Each user has their own account with email/password authentication. A **household** groups users who share a budget. After registering and verifying their email, a user can create a new household (becomes OWNER, receives an 8-character invite code) or join an existing one.

Two join paths:
- **Invite code** — enter the code directly, instant join as MEMBER
- **Email invitation** — owner invites by email, target accepts or declines

### Expense Types
- **Personal** — belongs to one user, only they can create/edit/delete it. Visible to all household members for budget calculations.
- **Shared** — belongs to the household. Any member can *propose* changes, but changes require approval from the other member(s) before taking effect.

### Expense Frequency
- **Monthly** — recurring every month at the stated amount
- **Yearly** — total annual amount with two payment strategies:
  - **Pay in full** — full amount in a specific month
  - **Installments** — divided across SEMI_ANNUAL (2), QUARTERLY (4), or MONTHLY (12) payments
  - For budget calculations, yearly expenses are always normalized to a monthly equivalent (total ÷ 12)

### Approval Workflow
When a member proposes a shared expense change (create / edit / delete) or a shared savings withdrawal:
1. A pending approval record is created
2. The other member reviews it and can **accept** (with optional message) or **reject** (with required message)
3. Only accepted changes take effect
4. The original proposer can **cancel** a pending approval before it is reviewed

### Settlement
The system calculates who owes whom based on shared expenses. Each member's share is computed (50/50 for split expenses, full amount if assigned to one person), and a net settlement amount is displayed. Members can mark the current month as settled to create an audit trail.

---

## User Stories

### Story 1: Registration & Email Verification ✅
**As a** new user
**I want to** register an account and verify my email
**So that** I can start using the app securely

**Acceptance Criteria:**
- [x] Registration form: email, password (8–72 chars), first name (1–50), last name (1–50)
- [x] Email uniqueness enforced with enumeration prevention (same response whether email exists or not)
- [x] 6-digit verification code sent to email (stored in Redis, 10-min TTL)
- [x] Verify code endpoint auto-logs in on success (returns JWT tokens)
- [x] Resend code endpoint (rate limited: 3 per 10 min)
- [x] Login blocked until email is verified (403)
- [x] Frontend: registration form → code input screen → redirect to dashboard

---

### Story 2: Login, Logout & Password Recovery ✅
**As a** registered user
**I want to** log in securely, stay authenticated, and recover my password if needed
**So that** my financial data is protected and accessible

**Acceptance Criteria:**
- [x] Login with email + password → JWT access token (15 min) + refresh token (7 days)
- [x] Login blocked if email not verified (403 with helpful message)
- [x] Refresh token rotation: old token invalidated, new one issued on each refresh
- [x] Logout invalidates the specific refresh token used
- [x] Forgot password → sends reset email with 1-hour token
- [x] Reset password → validates token, updates password, invalidates ALL sessions
- [x] All auth endpoints rate-limited (3–10 req/min depending on sensitivity)
- [x] Frontend: auto-refresh on 401 via Angular HttpClient interceptor
- [x] Frontend: protected routes redirect to login if unauthenticated

---

### Story 3: Household Management & Invitations ✅
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
- [x] Owner can remove any member
- [x] Owner must transfer ownership before leaving (if household has members)
- [x] Owner can transfer OWNER role to another member (atomic transaction)
- [x] Household respects maxMembers constraint (Phase 1: 2)
- [x] Duplicate pending invitations prevented
- [x] Race condition guard on accept (household could be full between check and action)

---

### Story 4: Salary Management ✅
**As a** household member
**I want to** set my own default and current monthly salary
**So that** the household income calculations are accurate

**Acceptance Criteria:**
- [x] Each user has two salary fields: default (baseline) and current (this month, can vary)
- [x] Only I can edit my own salary (upsert semantics — create or update for the current month)
- [x] All household members can view all salaries
- [x] Salary values display in EUR currency format
- [x] Values persist per month/year via Prisma
- [x] Negative values rejected
- [x] Month and year auto-determined from server clock

---

### Story 5: Personal Expense Management ✅
**As a** household member
**I want to** manage my own personal recurring and one-time expenses
**So that** I can track spending that only I am responsible for

**Acceptance Criteria:**
- [x] Create expense with: name (1–100 chars), amount (≥1), category (RECURRING/ONE_TIME), frequency (MONTHLY/YEARLY)
- [x] Yearly expenses: choose payment strategy (full in specific month, or installments)
- [x] Only I can edit/delete my personal expenses
- [x] My partner can see my expenses (for household overview) but cannot modify them
- [x] One-time expenses scoped to a specific month/year
- [x] Soft-delete support (`deletedAt` timestamp, row preserved)
- [x] List endpoint supports category and frequency query filters

---

### Story 6: Shared Expense Proposals ✅
**As a** household member
**I want to** propose shared expenses that affect both of us
**So that** we can collaboratively manage our joint financial obligations

**Acceptance Criteria:**
- [x] Can propose a new shared expense → creates a PENDING approval (expense not yet active)
- [x] Can propose editing an existing shared expense → creates approval with proposed changes in `proposedData`
- [x] Can propose deleting an existing shared expense → creates approval
- [x] Duplicate pending approvals prevented (ConflictException if expense already has a pending approval)
- [x] `paidByUserId` validated as a current household member
- [x] Frontend: pending proposals shown with "Pending" badge

---

### Story 7: Expense Approval Workflow ✅
**As a** household member
**I want to** review and approve or reject proposed shared expense changes
**So that** both partners agree on household spending

**Acceptance Criteria:**
- [x] List pending approvals for the household
- [x] Each approval shows: action type (CREATE/UPDATE/DELETE), proposed values, who proposed it
- [x] Can ACCEPT with an optional message
- [x] Can REJECT with a required message (reason visible to proposer)
- [x] Accepted proposals take effect immediately via Prisma transaction
- [x] Self-review prevented (reviewer ≠ requester → ForbiddenException)
- [x] Already-reviewed prevention (ConflictException if not PENDING)
- [x] Approval history viewable with optional status filter
- [x] Original proposer can cancel their own pending approval

---

### Story 8: Yearly Expense Payment Configuration ✅
**As a** household member
**I want to** configure how yearly expenses are paid
**So that** I can plan for large annual expenses flexibly

**Acceptance Criteria:**
- [x] Choose "Pay in full": select payment month (1–12) + who pays (one person or split)
- [x] Choose "Installments": select frequency (MONTHLY, QUARTERLY, SEMI_ANNUAL) + who pays
- [x] Monthly equivalent always shown for budget planning (total ÷ 12)
- [x] Works for both personal and shared yearly expenses
- [x] Shared yearly expenses go through the approval workflow

---

### Story 9: Settlement & Debt Tracking ✅
**As a** couple managing shared expenses
**I want to** see exactly who owes whom each month
**So that** we can settle debts fairly without manual calculation

**Acceptance Criteria:**
- [x] All shared expenses calculated automatically
- [x] Each person's share computed (50/50 for split, full amount if assigned)
- [x] Net settlement displayed context-aware: "You owe [Name] €XXX" or "[Name] owes you €XXX"
- [x] Settlement updates as shared expenses change
- [x] "Mark as Settled" creates an audit trail record with duplicate prevention
- [x] ConflictException if already settled this month; BadRequestException if no settlement needed (balance = 0)
- [x] Historical settlements viewable per month

---

### Story 10: Financial Dashboard ✅
**As a** household member
**I want to** see a comprehensive overview of our household finances
**So that** I can make informed financial decisions

**Acceptance Criteria:**
- [x] Individual income data for each member (default + current salary)
- [x] Total household income (default + current totals)
- [x] Personal expense totals per member (monthly equivalent)
- [x] Shared expense total (monthly equivalent)
- [x] Individual savings: income − personal expenses − shared expense share
- [x] Combined household savings
- [x] Pending approvals count (excluding own pending approvals)
- [x] Expense normalization: yearly ÷ 12, one-time only in matching month/year
- [x] Frontend: negative balances in red, positive in cyan

---

### Story 11: Savings Withdrawal ✅
**As a** household member
**I want to** withdraw from my personal or shared savings
**So that** I can access saved money when needed

**Acceptance Criteria:**
- [x] Personal savings withdrawal: immediate, amount > 0 and ≤ current balance
- [x] Shared savings withdrawal: creates a WITHDRAW_SAVINGS approval (requires other member's acceptance)
- [x] Approval acceptance executes withdrawal within a Prisma transaction
- [x] Optional month/year parameters (defaults to current month/year)
- [x] Savings and dashboard caches cleared after withdrawal

---

### Story 12: Expense Payment Tracking ✅
**As a** household member
**I want to** mark individual expense months as paid
**So that** I can track which bills have been settled without affecting the expense itself

**Acceptance Criteria:**
- [x] Mark a specific expense month as PAID (creates or updates an `ExpensePaymentStatus` record)
- [x] Mark a month back as PENDING (undo a paid status)
- [x] View all payment statuses for a given expense
- [x] View all household payment statuses in a single request
- [x] Unique constraint: one status record per (expense, month, year)

---

### Story 13: Expense Overrides ✅
**As a** household member
**I want to** override the amount of any expense for a specific month, or skip it entirely
**So that** I can handle temporary changes without modifying the base expense

**Acceptance Criteria:**
- [x] Upsert a single override for a (expense, month, year): custom amount or `skipped: true`
- [x] Batch upsert overrides for multiple months in one request
- [x] Delete all upcoming overrides for an expense from a given month/year forward
- [x] Overrides take precedence over the base expense amount in all calculations
- [x] Skipped months exclude the expense from budget calculations entirely

---

### Story 14: Account Deletion ✅
**As a** registered user
**I want to** permanently delete my account and associated data
**So that** I can exercise my right to data removal (GDPR)

**Acceptance Criteria:**
- [x] Solo user (no household): `DELETE /users/me` → anonymize immediately
- [x] Sole owner (no other members): delete household (cascade), then anonymize
- [x] Owner with members: two-phase flow — owner sends deletion request targeting a specific member
  - Target **accepts** → becomes OWNER, owner's personal data deleted, account anonymized
  - Target **rejects** → entire household deleted, owner anonymized
- [x] Only one pending deletion request per owner at a time
- [x] Deletion requests stored in Redis with 7-day TTL
- [x] Owner can cancel a pending request
- [x] Regular member: personal data removed from household, account anonymized
- [x] Anonymization preserves the user row for referential integrity (FK from expenses, settlements, approvals)
- [x] All sessions invalidated on deletion

---

### Story 15: Security & Data Protection ✅
**As a** user
**I want to** have my financial data stored securely
**So that** my personal and financial information is protected

**Acceptance Criteria:**
- [x] Passwords hashed with Argon2id (memory 64 MB, iterations 3, parallelism 1)
- [x] JWT access tokens expire after 15 minutes; refresh tokens after 7 days
- [x] Refresh token rotation: each use issues a new token and invalidates the old one
- [x] All sessions invalidated on password change or reset
- [x] Enumeration prevention: registration and password reset return identical responses regardless of email existence
- [x] Users can only access data within their own household
- [x] Sensitive endpoints rate-limited (3–10 requests/min)
- [x] CORS restricted to the configured frontend origin

---

### Story 16: Performance & Caching ✅
**As a** user
**I want to** have the app respond quickly even with complex financial calculations
**So that** the experience feels fast and reliable

**Acceptance Criteria:**
- [x] Salaries cached in Redis (5-min TTL)
- [x] Dashboard/summary calculations cached (2-min TTL)
- [x] Expense lists cached (1-min TTL)
- [x] Cache invalidated on any write operation affecting the household
- [x] Cached API responses < 50 ms; uncached < 200 ms
- [x] Cache keys scoped per household (no data leaks between households)
- [x] Cache misses handled gracefully with a fresh database query
