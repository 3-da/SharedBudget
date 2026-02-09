export interface Saving {
  id: string;
  userId: string;
  householdId: string;
  amount: number;
  month: number;
  year: number;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSavingRequest {
  amount: number;
  month?: number;
  year?: number;
}
