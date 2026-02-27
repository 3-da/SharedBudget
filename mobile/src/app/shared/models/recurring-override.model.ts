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

export interface DeleteAllOverridesResponse {
  message: string;
}

export interface BatchOverrideItem {
  year: number;
  month: number;
  amount: number;
  skipped?: boolean;
}

export interface BatchUpsertOverrideRequest {
  overrides: BatchOverrideItem[];
}
