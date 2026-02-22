# SharedBudget -- API Reference

63 endpoints across 11 controllers. All paths prefixed with `/api/v1`. Every endpoint requires JWT authentication unless marked **Public**.

Global rate limit: 100 requests per 60 seconds (all endpoints). Individual throttle overrides listed per endpoint.

---

## Error Response Shape

Every error response follows the `ErrorResponseDto` format:

```json
{
  "statusCode": 409,
  "message": "User already belongs to a household",
  "error": "Conflict",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "requestId": "abc-123-def"
}
```

For validation errors (400), `message` is an array of strings. The `requestId` correlates with server-side Pino log entries.

**Prisma error mapping:**

| Prisma Code | HTTP Status | Message |
|-------------|-------------|---------|
| P2002 | 409 Conflict | "A record with this value already exists" |
| P2025 | 404 Not Found | "Record not found" |

---

## Authentication (8 endpoints)

All auth endpoints are **Public** (no JWT required).

| Method | Path | Throttle | Description |
|--------|------|----------|-------------|
| POST | `/auth/register` | 3/60s, block 600s | Register new user. Sends 6-digit verification code. Returns generic message (enumeration prevention). |
| POST | `/auth/verify-code` | 5/60s, block 300s | Verify email with code. Auto-login on success (returns JWT tokens). |
| POST | `/auth/resend-code` | 3/600s | Resend verification code. Generic response regardless of email existence. |
| POST | `/auth/login` | 5/60s, block 300s | Authenticate with email + password. Returns access token (15m) + refresh token (7d). |
| POST | `/auth/refresh` | 30/60s | Exchange refresh token for new token pair. Old token invalidated (rotation). |
| POST | `/auth/logout` | 30/60s | Invalidate specific refresh token in Redis. |
| POST | `/auth/forgot-password` | 3/600s | Send password reset email. 1-hour TTL token. Generic response. |
| POST | `/auth/reset-password` | 5/60s, block 300s | Reset password using token. Invalidates ALL user sessions. |

---

## Household (11 endpoints)

All endpoints require JWT authentication. Role requirements noted per endpoint.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/household` | Any | Create household. User becomes OWNER. Generates 8-char invite code. |
| GET | `/household/mine` | Any | Get household with all members (names, roles, join dates). |
| POST | `/household/regenerate-code` | OWNER | Generate new invite code. Invalidates old code. |
| POST | `/household/invite` | OWNER | Invite user by email. Creates PENDING invitation. |
| GET | `/household/invitations/pending` | Any | List pending invitations targeting the current user. |
| POST | `/household/invitations/:id/respond` | Any | Accept or decline an invitation. |
| DELETE | `/household/invitations/:id` | OWNER | Cancel a sent invitation. |
| POST | `/household/join` | Any | Join household by invite code. User becomes MEMBER. |
| POST | `/household/leave` | Any | Leave household. OWNER must transfer ownership first if members exist. |
| DELETE | `/household/members/:userId` | OWNER | Remove a member from household. Cannot remove self. |
| POST | `/household/transfer-ownership` | OWNER | Transfer OWNER role to another member. Current owner becomes MEMBER. |

---

## User (8 endpoints)

All endpoints require JWT authentication. The `/me` convention derives user ID from the JWT token.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/users/me` | -- | Get own profile. |
| PUT | `/users/me` | -- | Update profile (first name, last name). |
| PUT | `/users/me/password` | -- | Change password. Requires current password. Invalidates all sessions. |
| DELETE | `/users/me` | -- | Delete account. Anonymizes user data. Behavior varies by role. |
| POST | `/users/me/delete-account-request` | OWNER | Request account deletion (owner with members). Targets a specific member. |
| GET | `/users/me/pending-delete-requests` | -- | List pending deletion requests targeting the current user. |
| POST | `/users/me/delete-account-request/:id/respond` | -- | Accept or reject a deletion request. |
| DELETE | `/users/me/delete-account-request` | OWNER | Cancel pending deletion request. |

---

## Salary (4 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/salary/me` | My salary for current month. Returns null if none set. |
| PUT | `/salary/me` | Upsert my salary (default + current amount). Month/year auto-determined. |
| GET | `/salary/household` | All household members' salaries for current month. |
| GET | `/salary/household/:year/:month` | Household salaries for a specific month. |

---

## Personal Expenses (5 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/expenses/personal` | List my personal expenses. Supports `category` and `frequency` query filters. |
| POST | `/expenses/personal` | Create personal expense. |
| GET | `/expenses/personal/:id` | Get personal expense details. |
| PUT | `/expenses/personal/:id` | Update personal expense. |
| DELETE | `/expenses/personal/:id` | Soft-delete personal expense (sets `deletedAt`). |

Personal expense mutations take effect immediately. No approval required.

---

## Shared Expenses (5 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/expenses/shared` | List shared expenses. Supports `category` and `frequency` query filters. |
| GET | `/expenses/shared/:id` | Get shared expense details. |
| POST | `/expenses/shared` | **Propose** new shared expense. Creates PENDING approval. |
| PUT | `/expenses/shared/:id` | **Propose** edit to shared expense. Creates PENDING approval. |
| DELETE | `/expenses/shared/:id` | **Propose** deletion of shared expense. Creates PENDING approval. |

POST, PUT, and DELETE do **not** directly mutate expenses. They create `ExpenseApproval` records. Another household member must accept before the change takes effect. Duplicate pending approvals on the same expense are prevented (409 Conflict).

---

## Approvals (5 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/approvals` | List pending approvals for the household. Includes `requestedBy` user objects. |
| GET | `/approvals/history` | Past approvals. Supports `status` query filter. Includes user objects. |
| PUT | `/approvals/:id/accept` | Accept pending approval. Optional message. Includes user objects in response. |
| PUT | `/approvals/:id/reject` | Reject pending approval. Required message. Includes user objects in response. |
| DELETE | `/approvals/:id` | Cancel own pending approval (original requester only). |

**Authorization rules:**
- Accept/reject: `requestedById !== userId` (cannot review own proposal)
- Cancel: `requestedById === userId` (can only cancel own proposal)

---

## Dashboard (4 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard` | Full financial overview: income, expenses, savings, settlement, pending approval count. |
| GET | `/dashboard/savings` | Savings breakdown per member (personal + shared). |
| GET | `/dashboard/settlement` | Settlement calculation: who owes whom and how much. |
| POST | `/dashboard/settlement/mark-paid` | Record settlement payment. Prevents duplicates (409 if already settled). |

The dashboard endpoint is the most expensive query -- aggregates across expenses, salaries, savings, and settlements. Cached for 120 seconds.

---

## Expense Payments (3 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/expense-payments/:expenseId` | Payment statuses for an expense. |
| PUT | `/expense-payments/:expenseId/:year/:month` | Mark a month as paid or pending. |
| GET | `/expense-payments/household` | All household payment statuses. |

---

## Recurring Overrides (4 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recurring-overrides/:expenseId` | List overrides for an expense. |
| PUT | `/recurring-overrides/:expenseId/:year/:month` | Upsert single override (amount and/or skipped). |
| PUT | `/recurring-overrides/:expenseId/batch` | Batch upsert multiple overrides. |
| DELETE | `/recurring-overrides/:expenseId/upcoming/:year/:month` | Delete all overrides from a month forward. |

---

## Savings (6 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/savings/me` | My savings (personal + shared). |
| POST | `/savings/me/personal` | Add personal savings. |
| POST | `/savings/me/shared` | Add shared savings. |
| POST | `/savings/me/personal/withdraw` | Withdraw from personal savings. Immediate. |
| POST | `/savings/me/shared/withdraw` | Request shared savings withdrawal. Creates WITHDRAW_SAVINGS approval. |
| GET | `/savings/household` | All household savings. |

Personal savings withdrawals take effect immediately. Shared savings withdrawals require approval from another household member.

---

## Endpoint Count Summary

| Controller | Endpoints |
|-----------|-----------|
| Auth | 8 |
| Household | 11 |
| User | 8 |
| Salary | 4 |
| Personal Expenses | 5 |
| Shared Expenses | 5 |
| Approvals | 5 |
| Dashboard | 4 |
| Expense Payments | 3 |
| Recurring Overrides | 4 |
| Savings | 6 |
| **Total** | **63** |
