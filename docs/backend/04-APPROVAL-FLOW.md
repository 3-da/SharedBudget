# Approval Flow Deep-Dive

The approval workflow is the most complex feature in SharedBudget. Every shared expense mutation -- create, update, or delete -- must pass through a proposal-and-review cycle before it takes effect. This document walks through the full lifecycle, from proposal to resolution, with the actual code that powers each step.

---

## 1. The Business Problem

Shared expenses belong to the entire household, not one person. If Sam could unilaterally create a 500-euro "furniture" expense that splits across everyone, there would be no accountability. The approval flow solves this: any household member can *propose* a change, but a *different* member must accept it before it touches real data.

**Scenario.** Alex (OWNER) and Sam (MEMBER) share a household. Sam wants to add a monthly internet bill. Sam proposes the expense. Alex sees it in the pending approvals list, reviews the amount, and accepts. Only then does the expense appear in the household ledger. If Alex disagrees, they reject it with a message explaining why. Sam can also cancel the proposal before anyone reviews it.

The approval flow also extends beyond expenses. Shared savings withdrawals follow the same pattern -- a member proposes a withdrawal, and another member must approve it before the savings balance is reduced.

This pattern applies uniformly: creating a new shared expense, editing an existing one, deleting one, or withdrawing from shared savings all follow the same propose-review-resolve cycle.

### Interview Questions This Section Answers
- Why did you add an approval workflow instead of letting any member modify shared expenses directly?
- How does the approval flow prevent abuse in a multi-user household?

---

## 2. The State Machine

Every approval starts as `PENDING` and resolves to exactly one terminal state.

```
                  +--> ACCEPTED  (by a different household member)
                  |
  PENDING --------+--> REJECTED  (by a different household member)
                  |
                  +--> CANCELLED (by the original requester)
                       stored as REJECTED with message
                       'Cancelled by requester'
```

**Transition rules:**

| Transition | Who can trigger | Guard |
|---|---|---|
| PENDING --> ACCEPTED | Any household member *except* the requester | `requestedById !== userId` |
| PENDING --> REJECTED | Any household member *except* the requester | `requestedById !== userId` |
| PENDING --> CANCELLED | Only the original requester | `requestedById === userId` |

Two things to notice. First, the authorization check is *reversed* for cancel versus accept/reject. Accept and reject require `requestedById !== userId` (you cannot review your own proposal). Cancel requires `requestedById === userId` (only you can withdraw your own proposal). Second, there is no separate `CANCELLED` enum value in the database. I chose to store cancellations as `REJECTED` with a fixed message string `'Cancelled by requester'`. This keeps the `ApprovalStatus` enum to three values (`PENDING`, `ACCEPTED`, `REJECTED`) and avoids a migration for what is functionally a rejection. The tradeoff is that distinguishing user-cancelled from reviewer-rejected requires checking the message text or whether `reviewedById === requestedById`.

### Interview Questions This Section Answers
- Walk me through the state transitions in your approval system.
- Why did you not add a separate CANCELLED status to the database enum?
- How do you prevent a user from approving their own proposal?

---

## 3. The Data Model

The `ExpenseApproval` table stores proposals and their outcomes:

```prisma
model ExpenseApproval {
  id            String         @id @default(uuid())
  expenseId     String?                              // null for CREATE actions
  householdId   String
  action        ApprovalAction                       // CREATE, UPDATE, DELETE, WITHDRAW_SAVINGS
  status        ApprovalStatus @default(PENDING)     // PENDING, ACCEPTED, REJECTED
  requestedById String
  reviewedById  String?
  message       String?                              // max 500 chars
  proposedData  Json?                                // full proposed expense shape
  createdAt     DateTime       @default(now())
  reviewedAt    DateTime?

  @@index([householdId, status])
  @@index([requestedById])
}
```

**Why `expenseId` is nullable.** A CREATE proposal has no expense yet -- the expense only comes into existence when the approval is accepted. UPDATE and DELETE proposals reference the existing expense they target.

**Why `proposedData` is JSON.** For CREATE, it stores the full proposed expense (name, amount, category, frequency, paidByUserId). For UPDATE, it stores only the changed fields. For DELETE, it is null -- there is nothing to propose beyond the intent to remove. For WITHDRAW_SAVINGS, it stores the withdrawal amount, month, and year. The `expenseId` is null since this action targets savings, not expenses. Using a JSON column avoids a separate "proposed expenses" table and keeps the proposal self-contained. The tradeoff is the loss of type safety at the database level, but the application layer validates the shape through DTOs before it reaches Prisma.

**Indexes.** The composite `(householdId, status)` index supports the most common query: "give me all pending approvals for this household." The `(requestedById)` index supports the dashboard query that counts pending approvals excluding the current user's own.

### Interview Questions This Section Answers
- Why is `expenseId` nullable on the approval model?
- How do you store the proposed data for different action types?
- What indexes did you add and why?

---

## 4. Proposing a Change (Entry Point)

Proposals enter the system through three methods on `SharedExpenseService`: `proposeCreateSharedExpense`, `proposeUpdateSharedExpense`, and `proposeDeleteSharedExpense`. All three follow the same pattern: validate membership, build the approval record, invalidate the approvals cache, and return the response.

Here is `proposeCreate` as a representative example:

```typescript
async proposeCreateSharedExpense(
    userId: string, dto: CreateSharedExpenseDto
): Promise<ApprovalResponseDto> {
    const membership = await this.expenseHelper.requireMembership(userId);
    if (dto.paidByUserId) {
        await this.expenseHelper.validatePaidByUserId(
            dto.paidByUserId, membership.householdId
        );
    }
    const proposedData = {
        name: dto.name, amount: dto.amount, category: dto.category,
        frequency: dto.frequency, paidByUserId: dto.paidByUserId ?? null,
        ...buildExpenseNullableFields(dto)
    };
    const approval = await this.prismaService.expenseApproval.create({
        data: {
            householdId: membership.householdId,
            action: ApprovalAction.CREATE,
            status: ApprovalStatus.PENDING,
            requestedById: userId,
            expenseId: null,
            proposedData
        },
    });
    await this.cacheService.invalidateApprovals(membership.householdId);
    return mapToApprovalResponse(approval);
}
```

Notice that `expenseId` is explicitly `null` for CREATE. The proposed expense shape is captured entirely in `proposedData`. For UPDATE and DELETE proposals, there is an additional guard -- `checkNoPendingApproval(expenseId)` -- that prevents multiple pending proposals from stacking up on the same expense. CREATE proposals skip this check because they have no expense to conflict with.

### Interview Questions This Section Answers
- How does a shared expense get created if it requires approval first?
- How do you prevent two pending proposals on the same expense?
- What validation happens before a proposal is recorded?

---

## 5. Accepting an Approval (The Core Logic)

Accept is the most complex operation because it does two things atomically: updates the approval status *and* mutates the expense. Here is the implementation:

```typescript
async acceptApproval(
    userId: string, approvalId: string, dto: AcceptApprovalDto
): Promise<ApprovalResponseDto> {
    const membership = await this.expenseHelper.requireMembership(userId);
    const approval = await this.findApprovalOrFail(
        approvalId, membership.householdId
    );

    if (approval.status !== ApprovalStatus.PENDING) {
        throw new ConflictException('This approval has already been reviewed');
    }
    if (approval.requestedById === userId) {
        throw new ForbiddenException('You cannot review your own approval');
    }

    const result = await this.prismaService.$transaction(async (tx) => {
        const updatedApproval = await tx.expenseApproval.update({
            where: { id: approvalId },
            data: {
                status: ApprovalStatus.ACCEPTED, reviewedById: userId,
                message: dto.message ?? null, reviewedAt: now
            },
            include: { requestedBy: ..., reviewedBy: ... },
        });

        if (approval.action === ApprovalAction.CREATE) {
            await tx.expense.create({ data: { ... } });
        } else if (approval.action === ApprovalAction.UPDATE) {
            await tx.expense.update({ where: { id: approval.expenseId! }, data: proposed });
        } else if (approval.action === ApprovalAction.DELETE) {
            await tx.expense.update({
                where: { id: approval.expenseId! },
                data: { deletedAt: now }   // SOFT DELETE
            });
        } else if (approval.action === ApprovalAction.WITHDRAW_SAVINGS) {
            const proposed = approval.proposedData as { amount: number; month: number; year: number };
            await this.savingService.executeSharedWithdrawal(
                approval.requestedById, approval.householdId,
                proposed.amount, proposed.month, proposed.year, tx,
            );
        }
        return updatedApproval;
    });

    await this.cacheService.invalidateHousehold(approval.householdId);
    return mapToApprovalResponse(result);
}
```

**Why the `$transaction` is critical.** Without it, you could end up with an approval marked as ACCEPTED but the expense creation failing -- or worse, the expense created but the approval still showing as PENDING. The interactive transaction (callback form) ensures both the approval status update and the expense mutation succeed or fail together. If any query inside the callback throws, Prisma rolls back the entire transaction.

**The four action branches.** CREATE instantiates a new expense from `proposedData`. UPDATE patches an existing expense with the proposed fields. DELETE sets `deletedAt` on the expense rather than removing the row -- this is a soft delete that preserves history for the settlement and timeline features. WITHDRAW_SAVINGS delegates to `SavingService.executeSharedWithdrawal`, which subtracts the withdrawal amount from the requester's shared savings within the same transaction.

### Interview Questions This Section Answers
- Why did you use a Prisma `$transaction` in the accept flow?
- What happens if the expense creation fails after the approval is marked as accepted?
- Why soft-delete instead of hard-delete for shared expenses?
- Walk me through the branching logic for CREATE vs UPDATE vs DELETE.

---

## 6. Rejecting an Approval

Rejection is structurally simpler than acceptance because no expense mutation occurs:

```typescript
async rejectApproval(
    userId: string, approvalId: string, dto: RejectApprovalDto
): Promise<ApprovalResponseDto> {
    const membership = await this.expenseHelper.requireMembership(userId);
    const approval = await this.findApprovalOrFail(
        approvalId, membership.householdId
    );

    if (approval.status !== ApprovalStatus.PENDING)
        throw new ConflictException('This approval has already been reviewed');
    if (approval.requestedById === userId)
        throw new ForbiddenException('You cannot review your own approval');

    const updatedApproval = await this.prismaService.expenseApproval.update({
        where: { id: approvalId },
        data: {
            status: ApprovalStatus.REJECTED, reviewedById: userId,
            message: dto.message, reviewedAt: new Date()
        },
        include: { requestedBy: ..., reviewedBy: ... },
    });

    await this.cacheService.invalidateApprovals(approval.householdId);
    return mapToApprovalResponse(updatedApproval);
}
```

The same two guards apply: the approval must be PENDING, and you cannot review your own proposal. The key difference from accept is the cache invalidation: `invalidateApprovals` instead of `invalidateHousehold`. Since no expense was created, updated, or deleted, there is no reason to bust the expense, settlement, or dashboard caches. Only the approvals list needs refreshing.

### Interview Questions This Section Answers
- Why is rejection simpler than acceptance in terms of implementation?
- Why does rejection not need a database transaction?

---

## 7. Cancelling an Approval

Cancel lets the original requester withdraw their own proposal before anyone reviews it:

```typescript
async cancelApproval(
    userId: string, approvalId: string
): Promise<ApprovalResponseDto> {
    // ... membership + findApprovalOrFail checks ...
    if (approval.status !== ApprovalStatus.PENDING)
        throw new ConflictException('...');
    if (approval.requestedById !== userId)
        throw new ForbiddenException(
            'Only the requester can cancel their own approval'
        );

    const updatedApproval = await this.prismaService.expenseApproval.update({
        data: {
            status: ApprovalStatus.REJECTED,
            reviewedById: userId,
            message: 'Cancelled by requester',
            reviewedAt: new Date()
        },
    });
    await this.cacheService.invalidateApprovals(approval.householdId);
}
```

The authorization logic is the mirror image of accept/reject. Here, `requestedById !== userId` triggers a `ForbiddenException` -- only the person who proposed the change can cancel it. The approval is stored as `REJECTED` with `reviewedById` set to the requester themselves and a fixed message `'Cancelled by requester'`.

**Design decision: no separate CANCELLED status.** I considered adding a fourth enum value but decided against it. The cancel action is functionally identical to a rejection from the system's perspective: the proposal did not go through and no expense was mutated. Adding a fourth status would require updating every query that checks for terminal states (`WHERE status != 'PENDING'`), every frontend filter, and the Prisma enum. The cost outweighed the benefit. If you need to distinguish cancellations in the UI, you check whether `reviewedById === requestedById`.

### Interview Questions This Section Answers
- How does the authorization check for cancel differ from accept/reject?
- Why did you store cancellations as REJECTED instead of adding a new status?
- What are the tradeoffs of that decision?

---

## 8. Validation Rules Summary

Every approval action runs through a consistent set of guards. The table below shows which checks apply to each operation:

| Check | Propose | Accept | Reject | Cancel |
|---|---|---|---|---|
| User must be a household member | Yes | Yes | Yes | Yes |
| Approval must exist in same household | -- | Yes | Yes | Yes |
| Approval must be PENDING | -- | Yes | Yes | Yes |
| User must NOT be the requester | -- | Yes | Yes | -- |
| User must BE the requester | -- | -- | -- | Yes |
| No existing pending approval for expense | Yes* | -- | -- | -- |

*Only for UPDATE and DELETE proposals. CREATE proposals have no expense to conflict with.

The self-review prevention rule (`requestedById === userId`) throws `ForbiddenException` on accept and reject, ensuring no member can rubber-stamp their own proposal. For cancel, the same comparison is *required* rather than forbidden -- you can only withdraw what you proposed.

Note that not all proposals originate from `SharedExpenseService`. WITHDRAW_SAVINGS proposals enter through the same approval system but are created by `SavingService.requestSharedWithdrawal`. The validation rules in the table above still apply identically -- household membership is verified, self-review is prevented, and the approval must be PENDING before it can be resolved.

### Interview Questions This Section Answers
- What validation checks are shared across all approval actions?
- How does self-review prevention work?
- Why is the authorization check reversed for cancel compared to accept/reject?

---

## 9. Cache Invalidation Strategy

The approval flow uses two levels of cache invalidation, chosen based on what data actually changed:

**Accept uses nuclear invalidation:**

```typescript
// CacheService.invalidateHousehold — clears ALL household caches
async invalidateHousehold(householdId: string): Promise<void> {
    await this.invalidatePattern(`cache:*:*:${householdId}:*`);
    await this.invalidatePattern(`cache:*:${householdId}:*`);
    await this.invalidatePattern(`cache:*:${householdId}`);
}
```

When an approval is accepted, an expense was created, updated, or soft-deleted. This affects the expense list, dashboard totals, settlement calculations, and timeline views. Rather than tracking every downstream cache key, `invalidateHousehold` wipes all cached data for the household. I chose correctness over surgical precision here -- a cache miss is cheap, serving stale settlement data is not.

**Reject and cancel use granular invalidation:**

```typescript
// CacheService.invalidateApprovals — clears only approval caches
async invalidateApprovals(householdId: string): Promise<void> {
    await this.invalidatePattern(`cache:approvals:*:${householdId}*`);
}
```

When an approval is rejected or cancelled, no expense data changed. Only the approval list and the pending count on the dashboard need refreshing. Clearing the entire household cache would be wasteful -- expense lists, settlements, and savings data are all still valid.

This two-tier strategy means the common case (viewing the dashboard after someone rejects a proposal) stays fast, while the critical case (accepting a proposal that mutates expenses) guarantees consistency across all views.

### Interview Questions This Section Answers
- Why do you use different cache invalidation strategies for accept vs reject?
- What does "nuclear invalidation" mean in this context and when is it justified?
- What is the risk of using granular invalidation for accept, and why did you avoid it?
