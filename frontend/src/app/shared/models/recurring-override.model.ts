export interface RecurringOverride {
  id: string;
  expenseId: string;
  month: number;
  year: number;
  amount: number;
  skipped: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertOverrideRequest {
  amount: number;
  skipped?: boolean;
}

export interface UpdateDefaultAmountRequest {
  amount: number;
}
