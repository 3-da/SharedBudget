export interface SalaryResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  defaultAmount: number;
  currentAmount: number;
  month: number;
  year: number;
}

export interface UpsertSalaryRequest {
  defaultAmount: number;
  currentAmount: number;
}
