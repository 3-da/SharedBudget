# Flexible Expense Partial Payment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow expenses to be marked as "fixed" (must pay exact amount) or "flexible" (planned budget; actual payment can vary). When marking a flexible expense as paid, the user enters how much they actually paid — the budget bar reflects actual spending.

**Architecture:** Add `isFixed: Boolean @default(true)` to the `Expense` table and `paidAmount: Decimal?` to `ExpensePaymentStatus`. Backend validates that flexible expenses require a `paidAmount` when marked paid. Frontend opens a dialog to collect the actual amount for flexible expenses, then stores it and uses it in budget calculations.

**Tech Stack:** NestJS 11 + Prisma (backend), Angular 21 + Angular Material M3 + signals (frontend), Vitest (backend tests), PostgreSQL.

**⚠️ Settlement note:** The dashboard settlement calculator (`dashboard-calculator.service.ts`) currently uses `expense.amount` for shared expense splits. Updating settlement to use `paidAmount` for flexible shared expenses is **deferred** — it requires joining ExpensePaymentStatus into the dashboard query, which is a separate concern. Track as follow-up.

---

## Key Files Reference

| Layer | File | Purpose |
|-------|------|---------|
| Schema | `backend/prisma/schema.prisma` | Add `isFixed`, `paidAmount` fields |
| Mappers | `backend/src/common/expense/expense.mappers.ts` | Add `isFixed` to `mapBaseExpenseFields`, `EXPENSE_FIELDS` |
| Payment svc | `backend/src/expense-payment/expense-payment.service.ts` | Validate + store `paidAmount` in `markPaid()` |
| MarkPaid DTO | `backend/src/expense-payment/dto/mark-paid.dto.ts` | Add optional `paidAmount` |
| Payment resp | `backend/src/expense-payment/dto/expense-payment-response.dto.ts` | Add `paidAmount` |
| Personal DTO | `backend/src/personal-expense/dto/create-personal-expense.dto.ts` | Add `isFixed` |
| Update DTO | `backend/src/personal-expense/dto/update-personal-expense.dto.ts` | Add `isFixed` |
| Shared DTO | `backend/src/shared-expense/dto/create-shared-expense.dto.ts` | Add `isFixed` |
| Shared upd | `backend/src/shared-expense/dto/update-shared-expense.dto.ts` | Add `isFixed` |
| Proposed | `backend/src/approval/interfaces/proposed-expense-data.interface.ts` | Add `isFixed?` |
| Personal resp | `backend/src/personal-expense/dto/personal-expense-response.dto.ts` | Add `isFixed` |
| Shared resp | `backend/src/shared-expense/dto/shared-expense-response.dto.ts` | Add `isFixed` |
| FE models | `frontend/src/app/shared/models/expense.model.ts` | Add `isFixed` |
| FE payment | `frontend/src/app/shared/models/expense-payment.model.ts` | Add `paidAmount` |
| FE store | `frontend/src/app/features/personal-expenses/stores/personal-expense.store.ts` | Map type change, paidTotal fix |
| FE store | `frontend/src/app/features/shared-expenses/stores/shared-expense.store.ts` | Same |
| FE card | `frontend/src/app/features/personal-expenses/components/expense-card.component.ts` | Input type change |
| FE card | `frontend/src/app/features/shared-expenses/components/shared-expense-card.component.ts` | Same |
| FE form | `frontend/src/app/features/personal-expenses/components/expense-form.component.ts` | isFixed toggle |
| FE dialog | `frontend/src/app/shared/components/partial-payment-dialog.component.ts` | New dialog |
| FE list | `frontend/src/app/features/personal-expenses/pages/personal-expense-list.component.ts` | Mark paid flow |
| FE list | `frontend/src/app/features/shared-expenses/pages/shared-expense-list.component.ts` | Same |

---

## Task 1: Prisma Schema — Add `isFixed` and `paidAmount`

**Files:**
- Modify: `backend/prisma/schema.prisma`

### Step 1: Edit the schema

In `backend/prisma/schema.prisma`, in the `Expense` model, add `isFixed` after `paidByUserId`:

```prisma
model Expense {
  // ... existing fields ...
  paidByUserId          String?
  isFixed               Boolean                @default(true)   // ← ADD THIS LINE
  month                 Int?
  // ... rest unchanged ...
}
```

In `ExpensePaymentStatus`, add `paidAmount` after `paidById`:

```prisma
model ExpensePaymentStatus {
  // ... existing fields ...
  paidAt    DateTime?
  paidById  String
  paidAmount Decimal?  @db.Decimal(12, 2)   // ← ADD THIS LINE
  createdAt DateTime      @default(now())
  // ... rest unchanged ...
}
```

### Step 2: Generate migration

Run in `backend/`:
```bash
npx prisma migrate dev --name add_flexible_expense_partial_payment
```

Expected output: `Your database is now in sync with your schema.`

If using Docker Compose, make sure the container is running first.

### Step 3: Verify generated Prisma client

The generated files at `backend/src/generated/prisma/models/Expense.ts` and `ExpensePaymentStatus.ts` should include the new fields. Quick check:
```bash
grep -n "isFixed\|paidAmount" backend/src/generated/prisma/models/Expense.ts backend/src/generated/prisma/models/ExpensePaymentStatus.ts
```
Expected: both fields appear.

### Step 4: Commit
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add isFixed to expenses, paidAmount to payment status (migration)"
```

---

## Task 2: Backend Response DTOs — Expose New Fields

**Files:**
- Modify: `backend/src/personal-expense/dto/personal-expense-response.dto.ts`
- Modify: `backend/src/shared-expense/dto/shared-expense-response.dto.ts`
- Modify: `backend/src/expense-payment/dto/expense-payment-response.dto.ts`

### Step 1: Read the three files

Read each file before editing (required by codebase convention).

### Step 2: Add `isFixed` to PersonalExpenseResponseDto

In `backend/src/personal-expense/dto/personal-expense-response.dto.ts`, add before `createdAt`:

```typescript
@ApiProperty({ example: true, description: 'Fixed: must pay full amount. Flexible: pay any amount.' })
isFixed!: boolean;
```

### Step 3: Add `isFixed` to SharedExpenseResponseDto

Same addition to `backend/src/shared-expense/dto/shared-expense-response.dto.ts`.

### Step 4: Add `paidAmount` to ExpensePaymentResponseDto

In `backend/src/expense-payment/dto/expense-payment-response.dto.ts`, add after `paidById`:

```typescript
@ApiPropertyOptional({ example: 50.00, description: 'Actual amount paid. Null for fixed expenses.' })
paidAmount!: number | null;
```

### Step 5: Commit
```bash
git add backend/src/personal-expense/dto/personal-expense-response.dto.ts \
        backend/src/shared-expense/dto/shared-expense-response.dto.ts \
        backend/src/expense-payment/dto/expense-payment-response.dto.ts
git commit -m "feat: add isFixed and paidAmount to expense response DTOs"
```

---

## Task 3: expense.mappers.ts — Wire `isFixed` Through Mapper

**Files:**
- Modify: `backend/src/common/expense/expense.mappers.ts`

### Step 1: Read the file (already read, shown above)

### Step 2: Add `isFixed` to `mapBaseExpenseFields`

In `mapBaseExpenseFields()`, add `isFixed` after `year`:

```typescript
function mapBaseExpenseFields(expense: any) {
    return {
        // ... existing fields ...
        year: expense.year ?? null,
        isFixed: expense.isFixed,   // ← ADD
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
    };
}
```

### Step 3: Add `'isFixed'` to `EXPENSE_FIELDS`

The `EXPENSE_FIELDS` constant is used by `pickDefined()` in `updatePersonalExpense()`. Adding `'isFixed'` here means updates with `isFixed` set will be picked up automatically.

```typescript
export const EXPENSE_FIELDS = [
    'name',
    'amount',
    'category',
    'frequency',
    'yearlyPaymentStrategy',
    'installmentFrequency',
    'installmentCount',
    'paymentMonth',
    'month',
    'year',
    'isFixed',   // ← ADD
] as const;
```

### Step 4: Commit
```bash
git add backend/src/common/expense/expense.mappers.ts
git commit -m "feat: add isFixed to expense mapper and EXPENSE_FIELDS"
```

---

## Task 4: MarkPaidDto — Add Optional `paidAmount`

**Files:**
- Modify: `backend/src/expense-payment/dto/mark-paid.dto.ts`

### Step 1: Read the file (already done above)

### Step 2: Add `paidAmount` field

The field is optional in the DTO. The service validates it's present for flexible expenses.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, Max, IsNumber, IsOptional } from 'class-validator';

export class MarkPaidDto {
    @ApiProperty({ example: 6, description: 'Month (1-12)', minimum: 1, maximum: 12 })
    @IsInt()
    @Min(1)
    @Max(12)
    month!: number;

    @ApiProperty({ example: 2026, description: 'Year', minimum: 2020, maximum: 2099 })
    @IsInt()
    @Min(2020)
    @Max(2099)
    year!: number;

    @ApiPropertyOptional({
        example: 50.00,
        description: 'Actual amount paid. Required for flexible (non-fixed) expenses. Omit for fixed expenses.',
        minimum: 0.01,
    })
    @IsOptional()
    @IsNumber()
    @Min(0.01)
    paidAmount?: number;
}
```

### Step 3: Run existing MarkPaidDto tests to make sure they still pass

```bash
cd backend && npx vitest run src/expense-payment/dto/mark-paid.dto.spec.ts
```

### Step 4: Update `mark-paid.dto.spec.ts` — add paidAmount tests

Open `backend/src/expense-payment/dto/mark-paid.dto.spec.ts` and add after existing tests:

```typescript
describe('paidAmount', () => {
    it('should accept when paidAmount is not provided (optional)', async () => {
        const dto = plainToInstance(MarkPaidDto, { month: 6, year: 2026 });
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'paidAmount')).toHaveLength(0);
    });

    it('should accept when paidAmount is a valid positive number', async () => {
        const dto = plainToInstance(MarkPaidDto, { month: 6, year: 2026, paidAmount: 50.00 });
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'paidAmount')).toHaveLength(0);
    });

    it('should reject paidAmount below minimum (0.01)', async () => {
        const dto = plainToInstance(MarkPaidDto, { month: 6, year: 2026, paidAmount: 0 });
        const errors = await validate(dto);
        const paidAmountErrors = errors.filter(e => e.property === 'paidAmount');
        expect(paidAmountErrors.length).toBeGreaterThan(0);
        expect(paidAmountErrors[0].constraints).toHaveProperty('min');
    });

    it('should reject paidAmount at boundary 0 (below minimum)', async () => {
        const dto = plainToInstance(MarkPaidDto, { month: 6, year: 2026, paidAmount: 0 });
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'paidAmount').length).toBeGreaterThan(0);
    });

    it('should accept paidAmount at exact minimum boundary (0.01)', async () => {
        const dto = plainToInstance(MarkPaidDto, { month: 6, year: 2026, paidAmount: 0.01 });
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'paidAmount')).toHaveLength(0);
    });
});
```

### Step 5: Run updated tests
```bash
cd backend && npx vitest run src/expense-payment/dto/mark-paid.dto.spec.ts
```
Expected: All tests pass.

### Step 6: Commit
```bash
git add backend/src/expense-payment/dto/mark-paid.dto.ts \
        backend/src/expense-payment/dto/mark-paid.dto.spec.ts
git commit -m "feat: add optional paidAmount to MarkPaidDto with boundary tests"
```

---

## Task 5: Create/Update Expense DTOs — Add `isFixed`

**Files:**
- Modify: `backend/src/personal-expense/dto/create-personal-expense.dto.ts`
- Modify: `backend/src/personal-expense/dto/update-personal-expense.dto.ts`
- Modify: `backend/src/shared-expense/dto/create-shared-expense.dto.ts`
- Modify: `backend/src/shared-expense/dto/update-shared-expense.dto.ts`

### Step 1: Read all four files

### Step 2: Add `isFixed` to `CreatePersonalExpenseDto`

Add this field before the `yearlyPaymentStrategy` section:

```typescript
import { ..., IsBoolean, IsOptional } from 'class-validator';

@ApiPropertyOptional({
    example: true,
    description: 'If true (default), expense must be paid in full. If false, user enters actual amount when paying.',
})
@IsOptional()
@IsBoolean()
isFixed?: boolean;
```

### Step 3: Add same field to `UpdatePersonalExpenseDto`

Add identical `isFixed` field.

### Step 4: Add same field to `CreateSharedExpenseDto` and `UpdateSharedExpenseDto`

Same pattern. Check if `UpdateSharedExpenseDto` extends `PartialType(CreateSharedExpenseDto)` — if so, only the Create DTO needs it. Read the file first to confirm.

### Step 5: Update CreatePersonalExpense DTO spec

Open `backend/src/personal-expense/dto/create-personal-expense.dto.spec.ts` and add:

```typescript
describe('isFixed', () => {
    it('should accept true', async () => {
        const dto = plainToInstance(CreatePersonalExpenseDto, validBase({ isFixed: true }));
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'isFixed')).toHaveLength(0);
    });

    it('should accept false', async () => {
        const dto = plainToInstance(CreatePersonalExpenseDto, validBase({ isFixed: false }));
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'isFixed')).toHaveLength(0);
    });

    it('should accept when isFixed is omitted (optional)', async () => {
        const dto = plainToInstance(CreatePersonalExpenseDto, validBase());
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'isFixed')).toHaveLength(0);
    });

    it('should reject non-boolean value', async () => {
        const dto = plainToInstance(CreatePersonalExpenseDto, validBase({ isFixed: 'yes' }));
        const errors = await validate(dto);
        expect(errors.filter(e => e.property === 'isFixed').length).toBeGreaterThan(0);
    });
});
```

(Where `validBase()` is a helper producing a minimum valid DTO — check existing tests for the pattern used in this spec file.)

### Step 6: Run DTO tests
```bash
cd backend && npx vitest run src/personal-expense/dto/ src/shared-expense/dto/
```
Expected: All pass.

### Step 7: Commit
```bash
git add backend/src/personal-expense/dto/ backend/src/shared-expense/dto/
git commit -m "feat: add isFixed flag to expense create/update DTOs"
```

---

## Task 6: ProposedExpenseData — Add `isFixed`

**Files:**
- Modify: `backend/src/approval/interfaces/proposed-expense-data.interface.ts`

### Step 1: Read the file (already done above)

### Step 2: Add `isFixed` to interface

```typescript
export interface ProposedExpenseData {
    name: string;
    amount: number;
    category: ExpenseCategory;
    frequency: ExpenseFrequency;
    yearlyPaymentStrategy?: YearlyPaymentStrategy | null;
    installmentFrequency?: InstallmentFrequency | null;
    installmentCount?: number | null;
    paymentMonth?: number | null;
    paidByUserId?: string | null;
    isFixed?: boolean | null;   // ← ADD
}
```

The `validateProposedData()` function does not need changes — `isFixed` is optional.

### Step 3: Commit
```bash
git add backend/src/approval/interfaces/proposed-expense-data.interface.ts
git commit -m "feat: add isFixed to ProposedExpenseData interface"
```

---

## Task 7: ExpensePaymentService — Validate and Store `paidAmount`

**Files:**
- Modify: `backend/src/expense-payment/expense-payment.service.ts`

### Step 1: Read the file (already done above)

### Step 2: Add `BadRequestException` import

At the top of the file, update the NestJS import:
```typescript
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
```

### Step 3: Update `markPaid()` method

Replace the current `markPaid` body with:

```typescript
async markPaid(userId: string, expenseId: string, dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
    this.logger.debug(`Mark expense paid: ${expenseId} for ${dto.month}/${dto.year} by user ${userId}`);

    const membership = await this.expenseHelper.requireMembership(userId);
    const expense = await this.findExpenseInHousehold(expenseId, membership.householdId);

    if (!expense.isFixed && (dto.paidAmount === undefined || dto.paidAmount === null)) {
        this.logger.warn(`paidAmount missing for flexible expense: ${expenseId}`);
        throw new BadRequestException('paidAmount is required for flexible expenses');
    }

    // Fixed expenses always store null (use expense.amount implicitly)
    const paidAmount = expense.isFixed ? null : dto.paidAmount!;

    const result = await this.prismaService.expensePaymentStatus.upsert({
        where: {
            expenseId_month_year: {
                expenseId,
                month: dto.month,
                year: dto.year,
            },
        },
        create: {
            expenseId,
            month: dto.month,
            year: dto.year,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            paidById: userId,
            paidAmount,
        },
        update: {
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            paidById: userId,
            paidAmount,
        },
    });

    await this.cacheService.invalidateExpenseCache(userId, expense.type, membership.householdId);
    this.logger.log(`Expense ${expenseId} marked as paid for ${dto.month}/${dto.year}, paidAmount: ${paidAmount ?? 'full'}`);
    return this.mapToResponse(result);
}
```

### Step 4: Update `undoPaid()` — clear `paidAmount` when undoing

In `undoPaid()`, update the update data to clear `paidAmount`:

```typescript
const result = await this.prismaService.expensePaymentStatus.update({
    where: { id: existing.id },
    data: {
        status: PaymentStatus.PENDING,
        paidAt: null,
        paidById: userId,
        paidAmount: null,   // ← ADD: clear actual amount when undoing
    },
});
```

### Step 5: Update `mapToResponse()` — include `paidAmount`

```typescript
private mapToResponse(record: any): ExpensePaymentResponseDto {
    return {
        id: record.id,
        expenseId: record.expenseId,
        month: record.month,
        year: record.year,
        status: record.status,
        paidAt: record.paidAt,
        paidById: record.paidById,
        paidAmount: record.paidAmount != null ? Number(record.paidAmount) : null,   // ← ADD
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}
```

### Step 6: Write tests — run failing first

Run existing tests to confirm they still pass before adding new ones:
```bash
cd backend && npx vitest run src/expense-payment/expense-payment.service.spec.ts
```

Some tests will fail because the mock expense (`mockPersonalExpense`) doesn't have `isFixed` and the upsert call assertions don't include `paidAmount`. Fix:

### Step 7: Update `expense-payment.service.spec.ts`

**a) Add `isFixed: true` to `mockPersonalExpense` and `mockSharedExpense`:**

```typescript
const mockPersonalExpense = {
    id: mockExpenseId,
    householdId: mockHouseholdId,
    createdById: mockUserId,
    name: 'Gym membership',
    amount: 49.99,
    type: ExpenseType.PERSONAL,
    isFixed: true,   // ← ADD
    deletedAt: null,
};

const mockSharedExpense = {
    id: 'expense-shared-001',
    householdId: mockHouseholdId,
    createdById: mockUserId,
    name: 'Internet bill',
    amount: 59.99,
    type: ExpenseType.SHARED,
    isFixed: true,   // ← ADD
    deletedAt: null,
};
```

**b) Add `paidAmount: null` to `mockPaymentStatusRecord`:**

```typescript
const mockPaymentStatusRecord = {
    id: 'ps-001',
    expenseId: mockExpenseId,
    month: 6,
    year: 2026,
    status: PaymentStatus.PAID,
    paidAt: new Date('2026-06-15T10:30:00.000Z'),
    paidById: mockUserId,
    paidAmount: null,   // ← ADD
    createdAt: new Date('2026-06-15T10:30:00.000Z'),
    updatedAt: new Date('2026-06-15T10:30:00.000Z'),
};
```

**c) Update `markPaid` happy-path upsert assertion** to include `paidAmount: null` in create/update:

```typescript
expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith({
    where: {
        expenseId_month_year: {
            expenseId: mockExpenseId,
            month: 6,
            year: 2026,
        },
    },
    create: {
        expenseId: mockExpenseId,
        month: 6,
        year: 2026,
        status: PaymentStatus.PAID,
        paidAt: expect.any(Date),
        paidById: mockUserId,
        paidAmount: null,   // ← ADD (fixed expense → null)
    },
    update: {
        status: PaymentStatus.PAID,
        paidAt: expect.any(Date),
        paidById: mockUserId,
        paidAmount: null,   // ← ADD
    },
});
```

**d) Update `undoPaid` update assertion** to include `paidAmount: null`:

```typescript
expect(mockPrismaService.expensePaymentStatus.update).toHaveBeenCalledWith({
    where: { id: 'ps-001' },
    data: {
        status: PaymentStatus.PENDING,
        paidAt: null,
        paidById: mockUserId,
        paidAmount: null,   // ← ADD
    },
});
```

**e) Update `getPaymentStatuses` field assertion** to include `paidAmount`:

```typescript
expect(result[0]).toEqual({
    id: 'ps-001',
    expenseId: mockExpenseId,
    month: 6,
    year: 2026,
    status: PaymentStatus.PAID,
    paidAt: mockPaymentStatusRecord.paidAt,
    paidById: mockUserId,
    paidAmount: null,   // ← ADD
    createdAt: mockPaymentStatusRecord.createdAt,
    updatedAt: mockPaymentStatusRecord.updatedAt,
});
```

**f) Add new tests for flexible expense behaviour** — add inside `describe('markPaid')`:

```typescript
it('should throw BadRequestException when flexible expense has no paidAmount', async () => {
    const flexibleExpense = { ...mockPersonalExpense, isFixed: false };
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expense.findFirst.mockResolvedValue(flexibleExpense);

    await expect(
        service.markPaid(mockUserId, mockExpenseId, { month: 6, year: 2026 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
        service.markPaid(mockUserId, mockExpenseId, { month: 6, year: 2026 }),
    ).rejects.toThrow('paidAmount is required for flexible expenses');

    expect(mockPrismaService.expensePaymentStatus.upsert).not.toHaveBeenCalled();
});

it('should store paidAmount for flexible expense', async () => {
    const flexibleExpense = { ...mockPersonalExpense, isFixed: false };
    const paymentRecord = { ...mockPaymentStatusRecord, paidAmount: 50 };
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expense.findFirst.mockResolvedValue(flexibleExpense);
    mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(paymentRecord);

    const result = await service.markPaid(mockUserId, mockExpenseId, { month: 6, year: 2026, paidAmount: 50 });

    expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
            create: expect.objectContaining({ paidAmount: 50 }),
            update: expect.objectContaining({ paidAmount: 50 }),
        }),
    );
    expect(result.paidAmount).toBe(50);
});

it('should ignore paidAmount for fixed expense (store null)', async () => {
    // Even if caller sends paidAmount, fixed expense always stores null
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expense.findFirst.mockResolvedValue(mockPersonalExpense); // isFixed: true
    mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(mockPaymentStatusRecord);

    await service.markPaid(mockUserId, mockExpenseId, { month: 6, year: 2026, paidAmount: 999 });

    expect(mockPrismaService.expensePaymentStatus.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
            create: expect.objectContaining({ paidAmount: null }),
            update: expect.objectContaining({ paidAmount: null }),
        }),
    );
});

it('should return paidAmount in response for flexible expense', async () => {
    const flexibleExpense = { ...mockPersonalExpense, isFixed: false };
    const paymentRecord = { ...mockPaymentStatusRecord, paidAmount: new Decimal(75.50) };
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expense.findFirst.mockResolvedValue(flexibleExpense);
    mockPrismaService.expensePaymentStatus.upsert.mockResolvedValue(paymentRecord);

    const result = await service.markPaid(mockUserId, mockExpenseId, { month: 6, year: 2026, paidAmount: 75.50 });

    expect(result.paidAmount).toBe(75.50);
});

it('should clear paidAmount when undoing a flexible expense payment', async () => {
    const flexibleExpense = { ...mockPersonalExpense, isFixed: false };
    const paymentRecord = { ...mockPaymentStatusRecord, paidAmount: 50 };
    mockExpenseHelper.requireMembership.mockResolvedValue(mockMembership);
    mockPrismaService.expense.findFirst.mockResolvedValue(flexibleExpense);
    mockPrismaService.expensePaymentStatus.findUnique.mockResolvedValue(paymentRecord);
    mockPrismaService.expensePaymentStatus.update.mockResolvedValue({
        ...paymentRecord,
        status: PaymentStatus.PENDING,
        paidAt: null,
        paidAmount: null,
    });

    const result = await service.undoPaid(mockUserId, mockExpenseId, { month: 6, year: 2026 });

    expect(mockPrismaService.expensePaymentStatus.update).toHaveBeenCalledWith({
        where: { id: 'ps-001' },
        data: expect.objectContaining({ paidAmount: null }),
    });
    expect(result.paidAmount).toBeNull();
});
```

Note: `Decimal` is a Prisma type — for mocks you can use raw numbers since `Number(record.paidAmount)` handles both. In tests, use raw `50` or `null` directly on the mock return value.

### Step 8: Run tests
```bash
cd backend && npx vitest run src/expense-payment/
```
Expected: All pass.

### Step 9: Commit
```bash
git add backend/src/expense-payment/
git commit -m "feat: validate and store paidAmount for flexible expenses in markPaid"
```

---

## Task 8: Personal and Shared Expense Services — Pass `isFixed` on Create

**Files:**
- Modify: `backend/src/personal-expense/personal-expense.service.ts`
- Modify: `backend/src/shared-expense/shared-expense.service.ts` (read first)
- Modify: `backend/src/approval/approval.service.ts` (read first)

### Step 1: Read `personal-expense.service.ts` (already read above)

### Step 2: Update `createPersonalExpense()`

In the `.create()` call, add `isFixed` explicitly (don't rely on Prisma default — be explicit):

```typescript
const expense = await this.prismaService.expense.create({
    data: {
        householdId: membership.householdId,
        createdById: userId,
        name: dto.name,
        amount: dto.amount,
        type: ExpenseType.PERSONAL,
        category: dto.category,
        frequency: dto.frequency,
        isFixed: dto.isFixed ?? true,   // ← ADD
        ...buildExpenseNullableFields(dto),
    },
});
```

The `updatePersonalExpense()` method uses `pickDefined(dto, [...EXPENSE_FIELDS])`. Since `'isFixed'` is now in `EXPENSE_FIELDS` (Task 3), updating `isFixed` via update endpoint is automatically handled.

### Step 3: Read `shared-expense.service.ts`

Look for the `proposeCreate()` or equivalent method that builds `proposedData` JSON. Add `isFixed` to the proposedData object:

```typescript
proposedData: {
    name: dto.name,
    amount: dto.amount,
    category: dto.category,
    frequency: dto.frequency,
    // ... other fields ...
    isFixed: dto.isFixed ?? true,   // ← ADD
},
```

Do the same for `proposeUpdate()` — include `isFixed` in the proposedData if it's in the update DTO.

### Step 4: Read `approval.service.ts`

Find the section that handles `ApprovalAction.CREATE` acceptance. It creates an Expense from `proposedData`. Add `isFixed`:

```typescript
await this.prismaService.expense.create({
    data: {
        householdId: approval.householdId,
        createdById: approval.requestedById,
        name: proposedData.name,
        amount: proposedData.amount,
        type: ExpenseType.SHARED,
        // ... other proposedData fields ...
        isFixed: proposedData.isFixed ?? true,   // ← ADD
        ...buildExpenseNullableFields(proposedData),
    },
});
```

For `ApprovalAction.UPDATE`, the existing update logic uses `pickDefined()` or spreads `proposedData`. Ensure `isFixed` is included in the update.

### Step 5: Run all service tests
```bash
cd backend && npx vitest run src/personal-expense/ src/shared-expense/ src/approval/
```
Expected: All pass.

### Step 6: Commit
```bash
git add backend/src/personal-expense/ backend/src/shared-expense/ backend/src/approval/
git commit -m "feat: propagate isFixed through personal, shared expense, and approval services"
```

---

## Task 9: Frontend Models — Add `isFixed` and `paidAmount`

**Files:**
- Modify: `frontend/src/app/shared/models/expense.model.ts`
- Modify: `frontend/src/app/shared/models/expense-payment.model.ts`

### Step 1: Read both files (already done above)

### Step 2: Update `expense.model.ts`

In the `Expense` interface, add `isFixed` after `createdById`:

```typescript
export interface Expense {
  id: string;
  name: string;
  amount: number;
  type: ExpenseType;
  category: ExpenseCategory;
  frequency: ExpenseFrequency;
  yearlyPaymentStrategy: YearlyPaymentStrategy | null;
  installmentFrequency: InstallmentFrequency | null;
  installmentCount: number | null;
  paymentMonth: number | null;
  paidByUserId: string | null;
  month: number | null;
  year: number | null;
  isFixed: boolean;      // ← ADD
  createdById: string;
  createdAt: string;
}
```

In `CreateExpenseRequest` and `UpdateExpenseRequest`, add:
```typescript
isFixed?: boolean;
```

### Step 3: Update `expense-payment.model.ts`

```typescript
export interface ExpensePayment {
  id: string;
  expenseId: string;
  month: number;
  year: number;
  status: PaymentStatus;
  paidAt: string | null;
  paidById: string;
  paidAmount: number | null;   // ← ADD
  createdAt: string;
  updatedAt: string;
}

export interface MarkPaidRequest {
  month: number;
  year: number;
  paidAmount?: number;   // ← ADD
}
```

### Step 4: Commit
```bash
git add frontend/src/app/shared/models/
git commit -m "feat: add isFixed and paidAmount to frontend expense models"
```

---

## Task 10: Frontend Stores — Fix `paidTotal` to Use Actual Amounts

**Why this task exists:** Currently `paymentStatuses = signal<Map<string, PaymentStatus>>`. We need the full `ExpensePayment` object to get `paidAmount` for `paidTotal()`. Change the map to store `ExpensePayment`.

**Files:**
- Modify: `frontend/src/app/features/personal-expenses/stores/personal-expense.store.ts`
- Modify: `frontend/src/app/features/shared-expenses/stores/shared-expense.store.ts` (read first)

### Step 1: Read `personal-expense.store.ts` (already done above)

### Step 2: Update `personal-expense.store.ts`

**a) Change import** — replace `PaymentStatus` with `ExpensePayment`:

```typescript
import { Expense, CreateExpenseRequest, UpdateExpenseRequest } from '../../../shared/models';
import { ExpensePayment } from '../../../shared/models/expense-payment.model';
```

Remove `PaymentStatus` from imports (it's no longer directly used in the store — only via `ExpensePayment.status`).

Add `PaymentStatus` back for the computed check:
```typescript
import { ExpensePayment, PaymentStatus } from '../../../shared/models/expense-payment.model';
// Or wherever PaymentStatus is exported from
```

Check existing imports — `PaymentStatus` may be in `'../../../shared/models'` barrel. Keep it if needed.

**b) Change signal type:**
```typescript
readonly paymentStatuses = signal<Map<string, ExpensePayment>>(new Map());
```

**c) Update `paidTotal()` computed:**
```typescript
readonly paidTotal = computed(() => {
  const statuses = this.paymentStatuses();
  return this.expenses()
    .filter(e => statuses.get(e.id)?.status === PaymentStatus.PAID)
    .reduce((sum, e) => {
      const payment = statuses.get(e.id);
      // For flexible expenses, use actual paidAmount; for fixed, use planned amount
      return sum + (payment?.paidAmount ?? e.amount);
    }, 0);
});
```

**d) Update `loadExpenses()` — store full ExpensePayment objects:**
```typescript
next: ({ expenses, statuses, skipped }) => {
    this.expenses.set(expenses);
    const map = new Map<string, ExpensePayment>();
    for (const s of statuses) map.set(s.expenseId, s);   // ← store whole object, not just s.status
    this.paymentStatuses.set(map);
    this.skippedExpenseIds.set(new Set(skipped));
    this.loading.set(false);
},
```

**e) Update `markPaid()` — accept optional `paidAmount`, store full response:**
```typescript
markPaid(expenseId: string, month: number, year: number, paidAmount?: number): void {
    this.paymentService.markPaid(expenseId, { month, year, paidAmount }).subscribe({
        next: p => {
            this.updatePaymentMap(expenseId, p);   // pass full ExpensePayment
            this.snackBar.open('Marked as paid', '', { duration: 2000 });
        },
        error: err => this.snackBar.open(err.error?.message ?? 'Failed', '', { duration: 4000 }),
    });
}
```

**f) Update `undoPaid()` — store full response:**
```typescript
undoPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.undoPaid(expenseId, { month, year }).subscribe({
        next: p => {
            this.updatePaymentMap(expenseId, p);
            this.snackBar.open('Set back to pending', '', { duration: 2000 });
        },
        error: err => this.snackBar.open(err.error?.message ?? 'Failed', '', { duration: 4000 }),
    });
}
```

**g) Update `updatePaymentMap()` — accept full `ExpensePayment`:**
```typescript
private updatePaymentMap(expenseId: string, payment: ExpensePayment): void {
    this.paymentStatuses.update(m => {
        const next = new Map(m);
        next.set(expenseId, payment);
        return next;
    });
}
```

### Step 3: Read and update `shared-expense.store.ts`

Apply the exact same changes as above (the shared expense store is a near-mirror of the personal one).

### Step 4: Commit
```bash
git add frontend/src/app/features/personal-expenses/stores/ \
        frontend/src/app/features/shared-expenses/stores/
git commit -m "feat: stores use full ExpensePayment object; paidTotal uses actual paidAmount"
```

---

## Task 11: ExpenseCardComponent — Update Input Type

**Files:**
- Modify: `frontend/src/app/features/personal-expenses/components/expense-card.component.ts`
- Modify: `frontend/src/app/features/shared-expenses/components/shared-expense-card.component.ts`

### Step 1: Read both files (personal card already read above, read shared card)

### Step 2: Update `expense-card.component.ts`

**a) Change import** — add `ExpensePayment`:
```typescript
import { ExpensePayment } from '../../../shared/models/expense-payment.model';
// Remove PaymentStatus from the models import if it's no longer needed in template
```

**b) Change input type:**
```typescript
readonly paymentStatus = input<ExpensePayment | null>(null);
```

**c) Update `isPaid` computed:**
```typescript
readonly isPaid = computed(() => this.paymentStatus()?.status === 'PAID');
```

Or keep `PaymentStatus.PAID` if it's imported. Use the enum value `PaymentStatus.PAID`.

**d) Add `paidAmount` display in template** — in the `<mat-card-content>` section, after the amount:

```html
<mat-card-content>
  <span class="amount">{{ expense().amount | currencyEur }}</span>
  @if (isPaid() && paymentStatus()?.paidAmount !== null && paymentStatus()?.paidAmount !== expense().amount) {
    <div class="paid-amount">Paid: {{ paymentStatus()!.paidAmount! | currencyEur }}</div>
  }
</mat-card-content>
```

Add style for `.paid-amount`:
```css
.paid-amount { font-size: 13px; color: var(--mat-sys-on-surface-variant); margin-top: 4px; }
```

### Step 3: Update `shared-expense-card.component.ts`

Read the file first, then apply:
- Change `paymentStatus = input<PaymentStatus | null>` to `input<ExpensePayment | null>`
- Update `isPaid` computed
- Add same `paidAmount` display in template

### Step 4: Check template binding in list components

In `personal-expense-list.component.ts`, the binding is:
```html
[paymentStatus]="store.paymentStatuses().get(e.id) ?? null"
```

This now returns `ExpensePayment | null` — the type matches the updated input. No change needed in the template syntax.

Same for `shared-expense-list.component.ts`.

### Step 5: Commit
```bash
git add frontend/src/app/features/personal-expenses/components/expense-card.component.ts \
        frontend/src/app/features/shared-expenses/components/shared-expense-card.component.ts
git commit -m "feat: expense cards accept ExpensePayment object, display actual paidAmount"
```

---

## Task 12: ExpenseFormComponent — Add `isFixed` Toggle

**Files:**
- Modify: `frontend/src/app/features/personal-expenses/components/expense-form.component.ts`

This component is shared by both personal and shared expense forms.

### Step 1: Read the file (already done above)

### Step 2: Add `MatSlideToggleModule` import

```typescript
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
```

Add to `imports` array: `MatSlideToggleModule`.

### Step 3: Add `isFixed` form control

In `this.fb.nonNullable.group({...})`, add:
```typescript
isFixed: [true as boolean],
```

### Step 4: Add `isFixed` to the template — after the `amount` field, before `category`:

```html
<div class="toggle-row">
  <mat-slide-toggle formControlName="isFixed" color="primary">
    Fixed expense
  </mat-slide-toggle>
  @if (form.controls.isFixed.value) {
    <span class="toggle-hint">Must be paid in full each time.</span>
  } @else {
    <span class="toggle-hint">Flexible — you choose how much you pay each month.</span>
  }
</div>
```

Add style:
```css
.toggle-row { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
.toggle-hint { font-size: 12px; color: var(--mat-sys-on-surface-variant); }
```

### Step 5: Patch `isFixed` in the edit effect

In the `effect(() => { const e = this.expense(); ... })`, add:
```typescript
this.form.patchValue({
    name: e.name, amount: e.amount, category: e.category, frequency: e.frequency,
    yearlyPaymentStrategy: e.yearlyPaymentStrategy, installmentFrequency: e.installmentFrequency,
    paymentMonth: e.paymentMonth, month: e.month, year: e.year, paidByUserId: e.paidByUserId,
    isFixed: e.isFixed,   // ← ADD
});
```

### Step 6: Include `isFixed` in `onSubmit()`

```typescript
onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    const dto: CreateExpenseRequest = {
        name: val.name, amount: val.amount, category: val.category, frequency: val.frequency,
        isFixed: val.isFixed,   // ← ADD
    };
    // ... rest of the method unchanged ...
}
```

### Step 7: Commit
```bash
git add frontend/src/app/features/personal-expenses/components/expense-form.component.ts
git commit -m "feat: add isFixed toggle to expense form (default: fixed)"
```

---

## Task 13: PartialPaymentDialogComponent — New Dialog

**Files:**
- Create: `frontend/src/app/shared/components/partial-payment-dialog.component.ts`

### Step 1: Check existing dialog patterns

Read `frontend/src/app/shared/components/confirm-dialog.component.ts` to understand the pattern used.

### Step 2: Write the component

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DecimalPipe } from '@angular/common';
import { CurrencyEurPipe } from '../pipes/currency-eur.pipe';

export interface PartialPaymentDialogData {
  expenseName: string;
  plannedAmount: number;
}

@Component({
  selector: 'app-partial-payment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, CurrencyEurPipe],
  template: `
    <h2 mat-dialog-title>How much did you pay?</h2>
    <mat-dialog-content>
      <p class="expense-name">{{ data.expenseName }}</p>
      <p class="planned">Planned budget: <strong>{{ data.plannedAmount | currencyEur }}</strong></p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Amount paid (EUR)</mat-label>
          <input matInput type="number" formControlName="paidAmount" min="0.01" step="0.01" [attr.aria-label]="'Amount paid for ' + data.expenseName">
          <mat-error>Enter a valid amount greater than 0</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="confirm()" [disabled]="form.invalid">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .expense-name { font-weight: 500; margin-bottom: 4px; }
    .planned { color: var(--mat-sys-on-surface-variant); margin-bottom: 16px; font-size: 14px; }
    .full-width { width: 100%; }
  `],
})
export class PartialPaymentDialogComponent {
  readonly data = inject<PartialPaymentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PartialPaymentDialogComponent>);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    paidAmount: [this.data.plannedAmount, [Validators.required, Validators.min(0.01)]],
  });

  confirm(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value.paidAmount);
  }
}
```

Note: The dialog pre-fills with `plannedAmount` as the default (most common case: pay the full planned amount). User can adjust down.

### Step 3: Commit
```bash
git add frontend/src/app/shared/components/partial-payment-dialog.component.ts
git commit -m "feat: add PartialPaymentDialogComponent for flexible expense payments"
```

---

## Task 14: PersonalExpenseListComponent — Flexible Expense Mark Paid Flow

**Files:**
- Modify: `frontend/src/app/features/personal-expenses/pages/personal-expense-list.component.ts`

### Step 1: Read the file (already done above)

### Step 2: Add imports

```typescript
import { PartialPaymentDialogComponent, PartialPaymentDialogData } from '../../../shared/components/partial-payment-dialog.component';
```

The file already imports `MatDialog` and `ConfirmDialogComponent`.

### Step 3: Update `onMarkPaid()`

Replace:
```typescript
onMarkPaid(id: string): void {
    this.store.markPaid(id, this.month(), this.year());
}
```

With:
```typescript
onMarkPaid(id: string): void {
    const expense = this.store.expenses().find(e => e.id === id);
    if (!expense) return;

    if (!expense.isFixed) {
        this.dialog.open<PartialPaymentDialogComponent, PartialPaymentDialogData, number>(
            PartialPaymentDialogComponent,
            { data: { expenseName: expense.name, plannedAmount: expense.amount }, width: '360px' },
        ).afterClosed().pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(paidAmount => {
            if (paidAmount != null) {
                this.store.markPaid(id, this.month(), this.year(), paidAmount);
            }
        });
    } else {
        this.store.markPaid(id, this.month(), this.year());
    }
}
```

### Step 4: Add `PartialPaymentDialogComponent` to imports array

```typescript
imports: [..., PartialPaymentDialogComponent],
```

Wait — `PartialPaymentDialogComponent` is opened via `MatDialog.open()`, not directly in template. It doesn't need to be in the component's `imports` array. But it does need to be standalone and importable. No change needed here.

### Step 5: Commit
```bash
git add frontend/src/app/features/personal-expenses/pages/personal-expense-list.component.ts
git commit -m "feat: open amount dialog for flexible expenses when marking paid (personal)"
```

---

## Task 15: SharedExpenseListComponent — Same Flexible Mark Paid Flow

**Files:**
- Modify: `frontend/src/app/features/shared-expenses/pages/shared-expense-list.component.ts`

### Step 1: Read the file

### Step 2: Apply the same `onMarkPaid()` pattern as Task 14

The shared expense list will have a similar `onMarkPaid()` method. Apply identical logic:
- Find expense in `store.expenses()`
- Check `expense.isFixed`
- If not fixed: open `PartialPaymentDialogComponent`
- If fixed: call `store.markPaid(id, month, year)` directly

### Step 3: Commit
```bash
git add frontend/src/app/features/shared-expenses/pages/shared-expense-list.component.ts
git commit -m "feat: open amount dialog for flexible expenses when marking paid (shared)"
```

---

## Task 16: End-to-End Verification

### Step 1: Run all backend tests
```bash
cd backend && npx vitest run
```
Expected: All pass. Fix any failures before proceeding.

### Step 2: Build the frontend
```bash
cd frontend && npx ng build
```
Expected: Build succeeds with no TypeScript errors.

### Step 3: Start the dev stack and manual smoke test

```bash
# Start backend + DB
docker-compose up -d

# Start backend
cd backend && npm run start:dev

# Start frontend
cd frontend && npx ng serve
```

**Manual test: Fixed expense (default)**
1. Create a new personal expense (Gym, €50, RECURRING, MONTHLY) — leave toggle at "Fixed"
2. In the expense list, click the checkmark (mark paid)
3. Expected: No dialog appears, expense immediately shows as "Paid"
4. Budget bar shows "Paid: €50 / €50"

**Manual test: Flexible expense**
1. Create a new personal expense (Groceries, €250, RECURRING, MONTHLY) — toggle "Fixed" OFF to "Flexible"
2. In the expense list, click the checkmark
3. Expected: Dialog appears with "How much did you pay?" pre-filled with €250
4. Change to €80 and confirm
5. Expected: Card shows "Paid" chip. Content shows "€250" (planned) and "Paid: €80" (actual) below
6. Budget bar shows "Paid: €130 (gym €50 + groceries €80) / €300 (€50+€250)"

**Manual test: Flexible expense undo**
1. Click undo on the groceries expense
2. Expected: Status returns to pending, "Paid: €80" disappears

**Manual test: Edit to switch fixed/flexible**
1. Edit the gym expense, toggle from Fixed to Flexible
2. Save
3. Click mark paid — dialog should now appear

### Step 4: Final commit
```bash
git add .
git commit -m "feat: flexible expense partial payment — complete implementation"
```

---

## Out of Scope / Follow-Up

### Settlement calculation for flexible shared expenses

The `dashboard-calculator.service.ts` computes settlement amounts based on `expense.amount`. For flexible shared expenses where the actual paid amount differs from planned, the settlement should use `paidAmount`.

**Future task:** In the dashboard query, join `ExpensePaymentStatus` for the given month/year and use `paidAmount ?? expense.amount` when computing who owes whom for PAID shared expenses with `isFixed: false`.

This is deferred because:
1. It requires modifying the dashboard query to join payment statuses
2. The settlement calculator is a separate, complex service
3. The core data model is correct — the `paidAmount` is stored and ready

---

## Summary of Changed Files

**Backend (16 files):**
- `backend/prisma/schema.prisma` — 2 new fields + migration
- `backend/src/common/expense/expense.mappers.ts` — add `isFixed`
- `backend/src/expense-payment/dto/mark-paid.dto.ts` — add `paidAmount`
- `backend/src/expense-payment/dto/mark-paid.dto.spec.ts` — new tests
- `backend/src/expense-payment/dto/expense-payment-response.dto.ts` — add `paidAmount`
- `backend/src/expense-payment/expense-payment.service.ts` — core logic
- `backend/src/expense-payment/expense-payment.service.spec.ts` — updated + new tests
- `backend/src/personal-expense/dto/create-personal-expense.dto.ts` — add `isFixed`
- `backend/src/personal-expense/dto/create-personal-expense.dto.spec.ts` — new tests
- `backend/src/personal-expense/dto/update-personal-expense.dto.ts` — add `isFixed`
- `backend/src/personal-expense/dto/personal-expense-response.dto.ts` — add `isFixed`
- `backend/src/personal-expense/personal-expense.service.ts` — pass `isFixed` on create
- `backend/src/shared-expense/dto/create-shared-expense.dto.ts` — add `isFixed`
- `backend/src/shared-expense/dto/update-shared-expense.dto.ts` — add `isFixed`
- `backend/src/shared-expense/dto/shared-expense-response.dto.ts` — add `isFixed`
- `backend/src/shared-expense/shared-expense.service.ts` — include `isFixed` in proposedData
- `backend/src/approval/interfaces/proposed-expense-data.interface.ts` — add `isFixed`
- `backend/src/approval/approval.service.ts` — include `isFixed` on CREATE/UPDATE acceptance

**Frontend (10 files):**
- `frontend/src/app/shared/models/expense.model.ts` — add `isFixed`
- `frontend/src/app/shared/models/expense-payment.model.ts` — add `paidAmount`
- `frontend/src/app/features/personal-expenses/stores/personal-expense.store.ts` — map type, paidTotal, markPaid
- `frontend/src/app/features/shared-expenses/stores/shared-expense.store.ts` — same
- `frontend/src/app/features/personal-expenses/components/expense-card.component.ts` — input type, show paidAmount
- `frontend/src/app/features/shared-expenses/components/shared-expense-card.component.ts` — same
- `frontend/src/app/features/personal-expenses/components/expense-form.component.ts` — isFixed toggle
- `frontend/src/app/shared/components/partial-payment-dialog.component.ts` — NEW
- `frontend/src/app/features/personal-expenses/pages/personal-expense-list.component.ts` — onMarkPaid flow
- `frontend/src/app/features/shared-expenses/pages/shared-expense-list.component.ts` — same
