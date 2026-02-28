import { PaymentStatus } from './enums';

export interface ExpensePayment {
  id: string;
  expenseId: string;
  month: number;
  year: number;
  status: PaymentStatus;
  paidAt: string | null;
  paidById: string;
  paidAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarkPaidRequest {
  month: number;
  year: number;
  paidAmount?: number;
}
