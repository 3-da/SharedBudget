# SharedBudget -- Data Model

11 Prisma models, 10 enums. PostgreSQL 18 with Prisma 7.3.0 via `@prisma/adapter-pg`.

---

## Enums

| Enum | Values | Purpose |
|------|--------|---------|
| HouseholdRole | `OWNER`, `MEMBER` | Member role in household |
| ExpenseType | `PERSONAL`, `SHARED` | Expense ownership type |
| ExpenseCategory | `RECURRING`, `ONE_TIME` | Expense recurrence |
| ExpenseFrequency | `MONTHLY`, `YEARLY` | Payment frequency |
| YearlyPaymentStrategy | `FULL`, `INSTALLMENTS` | How yearly expenses are paid |
| InstallmentFrequency | `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL` | Installment schedule (12, 4, or 2 payments/year) |
| ApprovalAction | `CREATE`, `UPDATE`, `DELETE`, `WITHDRAW_SAVINGS` | Type of proposed change |
| ApprovalStatus | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED` | Approval lifecycle state |
| InvitationStatus | `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED` | Invitation lifecycle state |
| PaymentStatus | `PENDING`, `PAID`, `CANCELLED` | Expense payment tracking |

All enums are PostgreSQL enum types enforced at the database level, not string columns.

---

## Models

### User

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | Unique, used for login |
| password | String | Argon2id hashed. Hidden from API responses (`@DtoEntityHidden`) |
| firstName | String | 1-50 characters |
| lastName | String | 1-50 characters |
| emailVerified | Boolean | Default `false`. Set `true` after email verification |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| deletedAt | DateTime? | Null = active. Non-null = soft-deleted. Hidden from API responses |

Soft delete preserves the row for referential integrity (foreign keys from expenses, settlements, approvals). Login checks `deletedAt IS NULL`.

### Household

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| name | String | Household display name |
| inviteCode | String | Unique 8-character hex code for joining. Read-only |
| maxMembers | Int | Default 2 (Phase 1). Read-only |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

### HouseholdMember

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK -> User. **Globally unique** -- a user belongs to at most one household |
| householdId | UUID | FK -> Household |
| role | HouseholdRole | OWNER or MEMBER. Default MEMBER |
| joinedAt | DateTime | When user joined |

**Constraint**: `userId` is globally unique (not just within a household). This enforces one-household-per-user at the database level. The compound unique on `(userId, householdId)` is technically redundant but documents the intended relationship.

### HouseholdInvitation

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| status | InvitationStatus | PENDING, ACCEPTED, DECLINED, CANCELLED |
| householdId | UUID | FK -> Household. **Cascade delete** |
| senderId | UUID | FK -> User (household owner who invited) |
| targetUserId | UUID | FK -> User (invited user) |
| createdAt | DateTime | Auto-generated |
| respondedAt | DateTime? | When target user responded. Null while PENDING |

**Indexes**: `(targetUserId, status)`, `(householdId, status)`, `(senderId)`

The only model with cascade delete. Invitations are meaningless without their household.

### Salary

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK -> User |
| householdId | UUID | FK -> Household |
| defaultAmount | Decimal(12,2) | Baseline monthly salary |
| currentAmount | Decimal(12,2) | Actual salary this month |
| month | Int | 1-12 |
| year | Int | e.g., 2026 |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Constraint**: Unique on `(userId, month, year)`. One salary record per user per month. Upsert semantics.

### Expense

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| householdId | UUID | FK -> Household |
| createdById | UUID | FK -> User (creator) |
| name | String | VarChar(100) |
| amount | Decimal(12,2) | Total amount in EUR |
| type | ExpenseType | PERSONAL or SHARED |
| category | ExpenseCategory | RECURRING or ONE_TIME |
| frequency | ExpenseFrequency | MONTHLY or YEARLY |
| yearlyPaymentStrategy | YearlyPaymentStrategy? | FULL or INSTALLMENTS. Null if monthly |
| installmentFrequency | InstallmentFrequency? | MONTHLY, QUARTERLY, SEMI_ANNUAL. Null if not installments |
| installmentCount | Int? | Number of installment payments (ONE_TIME INSTALLMENTS) |
| paymentMonth | Int? | 1-12, month to pay in full. Null if not FULL |
| paidByUserId | UUID? | FK -> User. Null = split equally among members |
| month | Int? | For ONE_TIME: which month |
| year | Int? | For ONE_TIME: which year |
| deletedAt | DateTime? | Soft delete timestamp |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

**Indexes**: `(householdId, type)`, `(createdById)`

**Expense type combinations:**

| Category | Frequency | Strategy | Example |
|----------|-----------|----------|---------|
| RECURRING | MONTHLY | -- | Monthly rent |
| RECURRING | YEARLY | FULL | Annual insurance in one month |
| RECURRING | YEARLY | INSTALLMENTS | Annual insurance split across months |
| ONE_TIME | MONTHLY | -- | One-time purchase this month |
| ONE_TIME | YEARLY | FULL | One-time annual payment |
| ONE_TIME | YEARLY | INSTALLMENTS | Laptop in 6 monthly installments |

### ExpenseApproval

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| expenseId | UUID? | FK -> Expense. **Null for CREATE actions** |
| householdId | UUID | FK -> Household |
| action | ApprovalAction | CREATE, UPDATE, DELETE, WITHDRAW_SAVINGS |
| status | ApprovalStatus | Default PENDING |
| requestedById | UUID | FK -> User (proposer) |
| reviewedById | UUID? | FK -> User (reviewer). Null while PENDING |
| message | String? | Reviewer's comment (max 500 chars) |
| proposedData | Json? | Full proposed expense shape (CREATE/UPDATE) or withdrawal params (WITHDRAW_SAVINGS). Null for DELETE |
| createdAt | DateTime | Auto-generated |
| reviewedAt | DateTime? | When review happened |

**Indexes**: `(householdId, status)`, `(requestedById)`

**State machine:**

```
              +--> ACCEPTED  (by a different household member)
              |
  PENDING ----+--> REJECTED  (by a different household member)
              |
              +--> CANCELLED (by original requester, stored as REJECTED
                              with message 'Cancelled by requester')
```

### Settlement

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| householdId | UUID | FK -> Household |
| month | Int | 1-12 |
| year | Int | Year settled |
| amount | Decimal(12,2) | Net amount in EUR |
| paidByUserId | UUID | FK -> User (who owed money) |
| paidToUserId | UUID | FK -> User (who was owed) |
| paidAt | DateTime | When marked as paid |

**Constraint**: Unique on `(householdId, month, year)`. One settlement per household per month. Designed for 2-member households (Phase 1).

### ExpensePaymentStatus

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| expenseId | UUID | FK -> Expense |
| month | Int | 1-12 |
| year | Int | e.g., 2026 |
| status | PaymentStatus | PENDING, PAID, CANCELLED |
| paidById | UUID? | FK -> User |
| paidAt | DateTime? | When marked as paid |

**Constraint**: Unique on `(expenseId, month, year)`.

### RecurringOverride

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| expenseId | UUID | FK -> Expense |
| month | Int | 1-12 |
| year | Int | e.g., 2026 |
| amount | Decimal(12,2) | Overridden amount for this month |
| skipped | Boolean | Default false. If true, expense excluded this month |

**Constraint**: Unique on `(expenseId, month, year)`.

Allows temporary amount changes or skipping without mutating the base expense record.

### Saving

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| userId | UUID | FK -> User |
| amount | Decimal(12,2) | Savings amount |
| month | Int | 1-12 |
| year | Int | e.g., 2026 |
| isShared | Boolean | true = shared (approval for withdrawal), false = personal |

**Constraint**: Unique on `(userId, month, year, isShared)`. A user can have both personal and shared savings for the same month.

---

## Relationships

```
User ---1:1---> HouseholdMember ---N:1---> Household
  |                                           |
  |---1:N---> Salary ---------------N:1------+
  |---1:N---> Saving ---------------N:1------+
  |---1:N---> Expense (creator) ----N:1------+
  |              |
  |              |---1:N---> ExpenseApproval ---N:1---> Household
  |              |              |--- requestedBy ---> User
  |              |              +--- reviewedBy ----> User (nullable)
  |              |---1:N---> ExpensePaymentStatus
  |              |              +--- paidBy ---------> User
  |              +---1:N---> RecurringOverride
  |
  |---1:N---> HouseholdInvitation (sender)
  |---1:N---> HouseholdInvitation (target)
  |---1:N---> Settlement (paidBy)
  +---1:N---> Settlement (paidTo)
```

**Cascade rules.** Only `HouseholdInvitation` uses cascade delete on household deletion. All other relations use `onDelete: Restrict` to prevent silently deleting financial records.

**Self-referential patterns.** `Settlement` has two FKs to User (`paidByUserId`, `paidToUserId`). Prisma requires named relations (`SettlementPayer`, `SettlementReceiver`) to disambiguate. Same pattern on `Expense` and `ExpenseApproval`.

---

## Indexing Strategy

| Index | Table | Query Pattern |
|-------|-------|---------------|
| `userId` (unique) | household_members | Look up user's household |
| `householdId` | household_members | List all members of a household |
| `(householdId, type)` | expenses | Fetch personal or shared expenses |
| `createdById` | expenses | Fetch expenses by creator |
| `(householdId, status)` | expense_approvals | Pending approvals for a household |
| `requestedById` | expense_approvals | Approvals requested by a user |
| `(targetUserId, status)` | household_invitations | Pending invitations for a user |
| `(householdId, status)` | household_invitations | Pending invitations for a household |
| `senderId` | household_invitations | Invitations sent by a user |
| `householdId` | salaries, savings | Fetch all for a household |
| `expenseId` | expense_payment_statuses, recurring_overrides | Fetch for a specific expense |

Composite indexes serve queries on the leading column alone (PostgreSQL can use `(householdId, type)` for queries filtering only by `householdId`).

Connection pooling: 20-30 connections via the PostgreSQL adapter.

---

## Soft Deletes

Two models use soft deletes: **User** and **Expense**.

- **User**: Preserves row for foreign key integrity. `deletedAt IS NULL` checked at query level in services.
- **Expense**: Preserves historical data for settlement calculations and financial summaries.

All other models use hard deletes. Soft delete filtering is explicit in service queries -- no Prisma middleware or global filter.

---

## Migrations

Schema-first workflow. Modify `schema.prisma`, run `npx prisma migrate dev --name description`.

| Migration | Description |
|-----------|-------------|
| `20260208045922_init` | Initial schema: 11 tables, 10 enums, all indexes and constraints |
| `20260208193809_add_payment_status_recurring_override_saving` | Added ExpensePaymentStatus, RecurringOverride, Saving models |
| `20260211095838_add_installment_count` | Added `installmentCount` field to Expense |

Production: `npx prisma migrate deploy` applies unapplied migrations without generating new ones.
