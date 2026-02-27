export interface Saving {
  id: string;
  userId: string;
  householdId: string;
  amount: number;
  month: number;
  year: number;
  isShared: boolean;
  reducesFromSalary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddSavingRequest {
  amount: number;
  month?: number;
  year?: number;
  reducesFromSalary?: boolean;
}

export interface WithdrawSavingRequest {
  amount: number;
  month?: number;
  year?: number;
}

export interface SharedWithdrawalResponse {
  approvalId: string;
  message: string;
}
