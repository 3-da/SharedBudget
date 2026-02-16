import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../generated/prisma/enums';

/**
 * Typed shape of the `proposedData` JSON field stored in ExpenseApproval records.
 * Used when creating or updating shared expenses upon approval acceptance.
 */
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
}

/**
 * Runtime validation for proposedData extracted from a JSON column.
 * Throws if the shape is invalid, preventing silent data corruption.
 */
export function validateProposedData(data: unknown): ProposedExpenseData {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid proposed data: expected an object');
    }
    const d = data as Record<string, unknown>;
    if (typeof d.name !== 'string' || typeof d.amount !== 'number') {
        throw new Error('Invalid proposed data: missing required name (string) or amount (number)');
    }
    return data as ProposedExpenseData;
}
