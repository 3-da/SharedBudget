# Database and Prisma ORM Layer

This document covers every database design decision in the SharedBudget backend: why PostgreSQL, why Prisma over TypeORM, how the 11 models fit together, and how indexing, soft deletes, migrations, and DTO generation work in practice.

---

## 1. Why PostgreSQL

I chose PostgreSQL over MongoDB and MySQL for three concrete reasons.

**ACID compliance for financial data.** SharedBudget tracks salaries, expenses, settlements, and savings -- all monetary. When a user accepts an approval, the system must update the approval status and create/update/delete the expense atomically. If either operation fails, both must roll back. PostgreSQL gives you serializable transactions out of the box; MongoDB's multi-document transactions were added in 4.0 and still carry performance penalties on sharded clusters.

**Foreign keys enforced at the database level.** Every expense belongs to a household. Every salary belongs to a user and a household. PostgreSQL enforces these relationships with real foreign key constraints, so orphaned records are structurally impossible. MongoDB delegates this to application code, which means a bug in one service can silently create dangling references.

**Relational domain fit with targeted JSONB.** The data model is fundamentally relational: users belong to households, households have expenses, expenses have approvals. One field -- `proposedData` on `ExpenseApproval` -- stores a JSON snapshot of the proposed expense changes. PostgreSQL's `Json` type handles this without forcing the entire schema into a document model. MySQL's JSON support works but lacks PostgreSQL's indexing and querying depth.

### Interview Questions This Section Answers
- Why did you choose PostgreSQL over MongoDB for a financial application?
- How do you handle semi-structured data in a relational database?
- What guarantees does ACID provide that matter for your domain?

---

## 2. Prisma as ORM

I chose Prisma over TypeORM for the NestJS backend.

**Schema-first, single source of truth.** Prisma defines the entire data model in `schema.prisma`. Models, relations, indexes, enums, and constraints all live in one file. TypeORM splits this across decorators on entity classes, which means the "truth" about your database is scattered across dozens of files. When I add a field, I change one place in Prisma; in TypeORM, I change the entity, potentially the migration, and possibly a DTO.

**No decorator/schema drift.** TypeORM entities use decorators like `@Column()` and `@ManyToOne()` that can fall out of sync with the actual database. I have seen projects where the entity says `nullable: false` but the migration never enforced it. Prisma generates migrations directly from the schema file, so the schema and the database always agree.

**`@prisma/adapter-pg` for Node.js native operation.** The `PrismaService` uses `@prisma/adapter-pg` (the PostgreSQL adapter) instead of the default Rust-based query engine. This removes the need for a platform-specific binary, which simplifies Docker builds and CI pipelines.

**No lazy loading means no N+1 surprises.** Prisma forces you to explicitly `include` relations in every query. There is no magic lazy loading that fires a hidden query when you access `expense.approvals`. If you forget to include a relation, you get `undefined` at compile time (with strict types), not a silent extra query at runtime.

### PrismaService Lifecycle

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL as string,
        });
        super({ adapter });
    }

    async onModuleInit(): Promise<void> {
        await this.$connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }
}
```

`PrismaService` extends `PrismaClient`, so every service that injects it gets full access to `prismaService.user.findMany(...)` and so on. `OnModuleInit` connects on application start; `OnModuleDestroy` disconnects on graceful shutdown.

### Two `$transaction` Styles

**Callback style** -- for operations that depend on intermediate results:

```typescript
// approval.service.ts: accept an approval (update status + apply the change)
const result = await this.prismaService.$transaction(async (tx) => {
    const updatedApproval = await tx.expenseApproval.update({
        where: { id: approvalId },
        data: { status: 'ACCEPTED', reviewedById, reviewedAt: new Date() },
    });
    // Use updatedApproval.proposedData to create/update/delete the expense
    // ...
    return updatedApproval;
});
```

The callback receives a transactional client `tx`. Every operation on `tx` runs inside one database transaction. If any operation throws, the entire transaction rolls back.

**Array style** -- for independent operations that just need atomicity:

```typescript
// household.service.ts: transfer ownership (demote + promote)
await this.prismaService.$transaction([
    this.prismaService.householdMember.update({
        where: { userId: ownerId },
        data: { role: HouseholdRole.MEMBER },
    }),
    this.prismaService.householdMember.update({
        where: { userId: targetUserId },
        data: { role: HouseholdRole.OWNER },
    }),
]);
```

Array style is simpler but does not let you use the result of one operation in the next. I use callback style when the second operation depends on the first (approvals), and array style when operations are independent (ownership transfer, invitation acceptance).

### Interview Questions This Section Answers
- Why Prisma over TypeORM in a NestJS project?
- What are the two transaction styles in Prisma and when do you use each?
- How does your PrismaService integrate with the NestJS lifecycle?

---

## 3. The 11 Models

### Core: User, Household, HouseholdMember

**User** stores authentication and identity. `email` is unique and used for login. `password` stores an Argon2 hash (never plaintext). `firstName` and `lastName` are constrained to 1-50 characters at both the DTO and database level. `emailVerified` defaults to `false` and flips to `true` after email confirmation. `deletedAt` is nullable: `null` means active, a timestamp means soft-deleted. The `password` and `deletedAt` fields are annotated with `@DtoEntityHidden` so the DTO generator excludes them from API responses.

**Household** represents a shared budget group. `inviteCode` is a unique 8-character string generated at creation, used for join-by-code. `maxMembers` defaults to 2 and caps household size. The `inviteCode` and `maxMembers` fields are `@DtoReadOnly` because only the system sets them.

**HouseholdMember** is the join table between User and Household with one critical constraint: `userId` is globally unique (`@unique`), not just unique within a household. This means a user can belong to exactly one household at a time. The `(userId, householdId)` compound unique constraint is technically redundant given the global unique on `userId`, but it documents the intended relationship explicitly. `role` defaults to `MEMBER`; only the household creator gets `OWNER`.

### Financial: Salary, Expense, Saving

**Salary** tracks income per user per month. `defaultAmount` is the baseline salary; `currentAmount` is the actual salary for that specific month (which may differ due to bonuses, deductions, etc.). Both use `Decimal(12, 2)` for cent-precise arithmetic -- never `float`. The `(userId, month, year)` unique constraint ensures one salary record per user per month.

**Expense** is the most complex model with 16 fields. `type` (PERSONAL/SHARED) determines visibility and splitting. `category` (RECURRING/ONE_TIME) determines duration. `frequency` (MONTHLY/YEARLY) determines payment schedule. `yearlyPaymentStrategy` and `installmentFrequency` are nullable because they only apply to yearly expenses. `paidByUserId` is nullable: `null` means the expense is split equally among all household members; a specific user ID means that user pays it alone. `month` and `year` are nullable because they only apply to one-time expenses (recurring expenses repeat every month). `deletedAt` enables soft delete so historical calculations remain accurate.

**Saving** records how much a user saves per month. `isShared` distinguishes personal savings (user decides alone) from shared savings (requires household approval to modify). The `(userId, month, year, isShared)` unique constraint allows a user to have both a personal and a shared saving entry for the same month.

### Workflow: ExpenseApproval, HouseholdInvitation

**ExpenseApproval** tracks proposed changes to shared expenses. `expenseId` is nullable: it is `null` when the action is `CREATE` (the expense does not exist yet). For `UPDATE` and `DELETE` actions, it references the existing expense. `proposedData` is a `Json` field storing the full proposed expense as a JSON object -- this avoids creating a parallel set of nullable columns for "proposed name", "proposed amount", etc. `reviewedById` is `null` while the approval is `PENDING` and gets set when another household member accepts or rejects it.

**HouseholdInvitation** tracks invitations sent between users. `householdId` has `onDelete: Cascade` -- the only cascade delete in the schema -- because invitations are meaningless without the household they reference. `respondedAt` is `null` while the invitation is `PENDING`.

### Tracking: Settlement, ExpensePaymentStatus, RecurringOverride

**Settlement** records the net payment between two users for a given month. `paidByUserId` is the user who owed money; `paidToUserId` is the user who was owed. Both reference User, making this a self-referential pattern through the same table. The `(householdId, month, year)` unique constraint ensures one settlement per household per month.

**ExpensePaymentStatus** tracks whether a specific expense has been paid for a given month. This is separate from the expense itself because a recurring expense generates a new payment status each month. `paidAt` is `null` while `status` is `PENDING`.

**RecurringOverride** allows temporarily changing a recurring expense's amount for a specific month, or skipping it entirely. `skipped` defaults to `false`; when `true`, the expense is excluded from that month's calculations regardless of the `amount` value. The `(expenseId, month, year)` unique constraint ensures one override per expense per month.

### Interview Questions This Section Answers
- Walk me through your data model. What are the main entities and how do they relate?
- Why is `paidByUserId` nullable on the Expense model?
- How do you handle recurring expenses that change amount in a specific month?
- Why did you use a JSON field for `proposedData` instead of separate columns?

---

## 4. The 10 Enums

Every enum in the schema is a PostgreSQL enum type, not a string column. This means invalid values are rejected at the database level, not just in application validation.

**HouseholdRole** (`OWNER`, `MEMBER`) -- controls permissions. Only `OWNER` can invite members, transfer ownership, or delete the household.

**ExpenseType** (`PERSONAL`, `SHARED`) -- `PERSONAL` expenses are visible only to the creator and do not affect settlement calculations. `SHARED` expenses require approval from other members and factor into the monthly split.

**ExpenseCategory** (`RECURRING`, `ONE_TIME`) -- `RECURRING` expenses repeat every month/year automatically. `ONE_TIME` expenses apply to a single month and require `month`/`year` fields.

**ExpenseFrequency** (`MONTHLY`, `YEARLY`) -- determines the payment schedule. Combined with `ExpenseCategory`, this creates the valid expense configurations:

| Category | Frequency | Strategy | Example |
|---|---|---|---|
| RECURRING | MONTHLY | -- | Monthly rent, subscriptions |
| RECURRING | YEARLY | FULL | Annual insurance paid in one month |
| RECURRING | YEARLY | INSTALLMENTS | Annual insurance split into payments |
| ONE_TIME | MONTHLY | -- | One-time purchase this month |
| ONE_TIME | YEARLY | FULL | One-time annual payment |

**YearlyPaymentStrategy** (`FULL`, `INSTALLMENTS`) -- only applies when `frequency` is `YEARLY`. `FULL` means one lump payment in `paymentMonth`. `INSTALLMENTS` means the amount is divided across the year according to `installmentFrequency`.

**InstallmentFrequency** (`MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`) -- determines how yearly installments are spread: 12, 4, or 2 payments per year.

**ApprovalStatus** (`PENDING`, `ACCEPTED`, `REJECTED`) -- a one-way state machine. An approval starts as `PENDING`, then transitions to either `ACCEPTED` or `REJECTED`. There is no transition back. The original requester can cancel a `PENDING` approval, but cancellation deletes the record rather than adding a fourth status.

**InvitationStatus** (`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`) -- `PENDING` is the initial state. The target user can `ACCEPT` or `DECLINE`. The sender can `CANCEL` a pending invitation. No transitions from terminal states.

**PaymentStatus** (`PENDING`, `PAID`, `CANCELLED`) -- tracks whether an expense payment for a specific month has been completed.

### Interview Questions This Section Answers
- Why use database-level enums instead of string columns?
- What are the valid expense type combinations and how do they interact?
- Describe the approval status lifecycle.

---

## 5. Relationships and Referential Integrity

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

**Cascade rules.** Only one model uses cascade delete: `HouseholdInvitation` cascades on household deletion (`onDelete: Cascade`). All other relations use the default `onDelete: Restrict`, which prevents deleting a user or household that still has dependent records. I chose restrict over cascade for financial data because silently deleting a user's expenses and settlements would corrupt historical records.

**Global unique on `HouseholdMember.userId`.** The `@unique` on `userId` (not on the compound `userId + householdId`) enforces that a user exists in at most one household globally. This was a deliberate domain constraint: the budgeting math assumes all of a user's income and expenses belong to one shared context.

**Self-referential patterns.** `Settlement` has two foreign keys to `User`: `paidByUserId` and `paidToUserId`. Prisma requires named relations (`"SettlementPayer"` and `"SettlementReceiver"`) to disambiguate. The same pattern appears on `Expense` (`ExpenseCreator` / `ExpensePayer`) and `ExpenseApproval` (`ApprovalRequester` / `ApprovalReviewer`).

### Interview Questions This Section Answers
- Why restrict deletes instead of cascading for financial records?
- How do you enforce "one household per user" at the database level?
- How does Prisma handle multiple foreign keys pointing to the same table?

---

## 6. Indexing Strategy

Every index exists because a specific query pattern needs it.

| Index | Table | Query Pattern |
|---|---|---|
| `userId` (unique) | `household_members` | Look up which household a user belongs to |
| `householdId` | `household_members` | List all members of a household |
| `(householdId, type)` | `expenses` | Fetch personal or shared expenses for a household |
| `createdById` | `expenses` | Fetch expenses created by a specific user |
| `(householdId, status)` | `expense_approvals` | List pending approvals for a household |
| `requestedById` | `expense_approvals` | List approvals requested by a specific user |
| `(targetUserId, status)` | `household_invitations` | Check pending invitations for a user |
| `(householdId, status)` | `household_invitations` | List pending invitations for a household |
| `senderId` | `household_invitations` | List invitations sent by a user |
| `householdId` | `salaries`, `savings` | Fetch all salaries/savings for a household |
| `expenseId` | `expense_payment_statuses`, `recurring_overrides` | Fetch statuses/overrides for a specific expense |

**Composite indexes** (`householdId + type`, `householdId + status`, `targetUserId + status`) are used where queries always filter on both columns. PostgreSQL can use a composite index for queries that filter on the leading column alone, so `(householdId, type)` also serves queries that filter only by `householdId` on the expenses table.

**Connection pooling** is configured for 20-30 connections through the PostgreSQL adapter. This range handles the expected concurrent load without exhausting database connections.

### Interview Questions This Section Answers
- How did you decide which indexes to create?
- What is the advantage of composite indexes over separate single-column indexes?

---

## 7. Soft Deletes

Two models use soft deletes: **User** and **Expense**. Both have a `deletedAt` field that is `null` for active records and contains a timestamp for deleted ones.

**User** uses soft delete because deleting a user's row would cascade-violate foreign keys on expenses, approvals, settlements, and salaries. Soft delete preserves the user record for historical reference while preventing login (service-level checks filter on `deletedAt IS NULL`).

**Expense** uses soft delete because historical expense data feeds into settlement calculations and financial summaries. Deleting an expense row would make past months' calculations incorrect.

The remaining 9 models use hard deletes. `HouseholdMember` records are deleted when a user leaves a household because the relationship is present-tense (you are or are not a member). `RecurringOverride` and `ExpensePaymentStatus` are operational records tied to a specific month -- deleting them simply reverts to the default state.

Soft delete filtering is enforced at the query level in services. Every query that reads users or expenses includes `where: { deletedAt: null }`. There is no Prisma middleware or global filter automating this, which means each service explicitly documents its awareness of soft-deleted records.

### Interview Questions This Section Answers
- Which models use soft deletes and why those specifically?
- How do you prevent accidentally querying soft-deleted records?
- Why not use soft deletes on every model?

---

## 8. Migration Strategy

Prisma uses a schema-first migration workflow. You modify `schema.prisma`, then run `npx prisma migrate dev --name description` to generate a SQL migration file. Prisma diffs the schema against the current database state and produces the minimal SQL to bring them in sync.

The project has three migrations:

1. **`20260208045922_init`** -- created the initial schema: all 11 tables, all 10 enums, all indexes and constraints.

2. **`20260208193809_add_payment_status_recurring_override_saving`** -- added the `ExpensePaymentStatus`, `RecurringOverride`, and `Saving` models. These were identified as necessary after the initial schema when tracking monthly payment status and savings became a requirement.

3. **`20260211095838_add_installment_count`** -- added the `installmentCount` field to `Expense`. This field tracks the total number of installments for yearly expenses paid in installments (e.g., 24 for a 2-year monthly plan).

Each migration is a timestamped directory under `prisma/migrations/` containing a `migration.sql` file. Migrations are applied in order and tracked in a `_prisma_migrations` table in the database. Running `npx prisma migrate deploy` in production applies any unapplied migrations without generating new ones.

### Interview Questions This Section Answers
- Describe your migration workflow from schema change to production deployment.
- How does Prisma detect what SQL to generate for a migration?

---

## 9. DTO Generation

The project uses `prisma-generator-nestjs-dto` to auto-generate three classes per model: an **Entity** class (the full model shape), a **CreateDto** (fields needed for creation), and an **UpdateDto** (fields that can be modified, all optional).

Generated DTOs include `class-validator` decorators (derived from schema comments like `/// @MinLength(1)`) and `@ApiProperty()` decorators for Swagger documentation. Output goes to `src/generated/dto/`.

**Schema annotations control generation behavior:**

- `/// @DtoReadOnly` -- the field appears in Entity but is excluded from CreateDto and UpdateDto. Used for `emailVerified`, `inviteCode`, `role`, and all server-set timestamps.
- `/// @DtoEntityHidden` -- the field is excluded from the Entity class entirely, so it never appears in API responses. Used for `password` and `deletedAt`.
- `/// @DtoCreateHidden` -- the field is excluded from CreateDto only. Used for `reviewedAt` on approvals.
- `/// @example` and `/// @minLength` / `/// @maxLength` -- generate Swagger examples and validation constraints.

**What is generated vs. hand-written.** Generated DTOs cover standard CRUD shapes that mirror the database model. Hand-written DTOs cover everything else: action-specific request DTOs (e.g., `TransferOwnershipDto`, `RespondToInvitationDto`), aggregated response DTOs (e.g., `DashboardOverviewDto`), and any DTO whose shape does not map directly to a single database model. The generated DTOs serve as a baseline; the hand-written DTOs handle the actual API contract.

### Interview Questions This Section Answers
- How do you keep your DTOs in sync with your database schema?
- What is the boundary between generated and hand-written DTOs in your project?
- How do you control which fields appear in API responses vs. request bodies?
