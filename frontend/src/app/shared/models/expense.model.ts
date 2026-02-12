import {
  ExpenseType,
  ExpenseCategory,
  ExpenseFrequency,
  YearlyPaymentStrategy,
  InstallmentFrequency,
} from './enums';

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
  createdById: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  name: string;
  amount: number;
  category: ExpenseCategory;
  frequency: ExpenseFrequency;
  yearlyPaymentStrategy?: YearlyPaymentStrategy;
  installmentFrequency?: InstallmentFrequency;
  installmentCount?: number;
  paymentMonth?: number;
  paidByUserId?: string;
  month?: number;
  year?: number;
}

export interface UpdateExpenseRequest {
  name?: string;
  amount?: number;
  category?: ExpenseCategory;
  frequency?: ExpenseFrequency;
  yearlyPaymentStrategy?: YearlyPaymentStrategy | null;
  installmentFrequency?: InstallmentFrequency | null;
  installmentCount?: number | null;
  paymentMonth?: number | null;
  paidByUserId?: string | null;
  month?: number | null;
  year?: number | null;
}
