export interface DashboardOverview {
  income: MemberIncome[];
  totalDefaultIncome: number;
  totalCurrentIncome: number;
  expenses: ExpenseSummary;
  savings: SavingsResponse;
  settlement: SettlementResponse;
  pendingApprovalsCount: number;
  month: number;
  year: number;
}

export interface MemberIncome {
  userId: string;
  firstName: string;
  lastName: string;
  defaultSalary: number;
  currentSalary: number;
}

export interface MemberExpenseSummary {
  userId: string;
  firstName: string;
  lastName: string;
  personalExpensesTotal: number;
  remainingExpenses: number;
}

export interface ExpenseSummary {
  personalExpenses: MemberExpenseSummary[];
  sharedExpensesTotal: number;
  totalHouseholdExpenses: number;
  remainingHouseholdExpenses: number;
}

export interface MemberSavings {
  userId: string;
  firstName: string;
  lastName: string;
  personalSavings: number;
  sharedSavings: number;
  remainingBudget: number;
}

export interface SavingsResponse {
  members: MemberSavings[];
  totalPersonalSavings: number;
  totalSharedSavings: number;
  totalSavings: number;
  totalRemainingBudget: number;
}

export interface SettlementResponse {
  amount: number;
  owedByUserId: string | null;
  owedByFirstName: string | null;
  owedToUserId: string | null;
  owedToFirstName: string | null;
  message: string;
  isSettled: boolean;
  month: number;
  year: number;
}

export interface SavingsHistoryItem {
  month: number;
  year: number;
  personalSavings: number;
  sharedSavings: number;
}

export interface MarkSettlementPaidResponse {
  id: string;
  householdId: string;
  month: number;
  year: number;
  amount: number;
  paidByUserId: string;
  paidToUserId: string;
  paidAt: string;
}
