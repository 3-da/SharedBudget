import { PersonalExpenseResponseDto } from '../../personal-expense/dto/personal-expense-response.dto';
import { SharedExpenseResponseDto } from '../../shared-expense/dto/shared-expense-response.dto';
import { ApprovalResponseDto } from '../../aproval/dto/approval-response.dto';

// Maps the common expense fields shared by both personal and shared response DTOs
function mapBaseExpenseFields(expense: any) {
    return {
        id: expense.id,
        householdId: expense.householdId,
        createdById: expense.createdById,
        name: expense.name,
        amount: Number(expense.amount),
        category: expense.category,
        frequency: expense.frequency,
        yearlyPaymentStrategy: expense.yearlyPaymentStrategy ?? null,
        installmentFrequency: expense.installmentFrequency ?? null,
        paymentMonth: expense.paymentMonth ?? null,
        month: expense.month ?? null,
        year: expense.year ?? null,
        createdAt: expense.createdAt,
        updatedAt: expense.updatedAt,
    };
}

// Maps a raw expense record to PersonalExpenseResponseDto
export function mapToPersonalExpenseResponse(expense: any): PersonalExpenseResponseDto {
    return mapBaseExpenseFields(expense);
}

// Maps a raw expense record to SharedExpenseResponseDto
export function mapToSharedExpenseResponse(expense: any): SharedExpenseResponseDto {
    return {
        ...mapBaseExpenseFields(expense),
        paidByUserId: expense.paidByUserId ?? null,
    };
}

// Maps a raw approval record to ApprovalResponseDto.
export function mapToApprovalResponse(approval: any): ApprovalResponseDto {
    return {
        id: approval.id,
        expenseId: approval.expenseId ?? null,
        householdId: approval.householdId,
        action: approval.action,
        status: approval.status,
        requestedById: approval.requestedById,
        reviewedById: approval.reviewedById ?? null,
        message: approval.message ?? null,
        proposedData: approval.proposedData ?? null,
        createdAt: approval.createdAt,
        reviewedAt: approval.reviewedAt ?? null,
    };
}

// Fields that are shared between create and update DTOs for expenses
export const EXPENSE_FIELDS = [
    'name',
    'amount',
    'category',
    'frequency',
    'yearlyPaymentStrategy',
    'installmentFrequency',
    'paymentMonth',
    'month',
    'year',
] as const;

// Builds the nullable expense fields from a create DTO, defaulting undefined values to null
export function buildExpenseNullableFields(dto: any) {
    return {
        yearlyPaymentStrategy: dto.yearlyPaymentStrategy ?? null,
        installmentFrequency: dto.installmentFrequency ?? null,
        paymentMonth: dto.paymentMonth ?? null,
        month: dto.month ?? null,
        year: dto.year ?? null,
    };
}
