export enum HouseholdRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export enum ExpenseType {
  PERSONAL = 'PERSONAL',
  SHARED = 'SHARED',
}

export enum ExpenseCategory {
  RECURRING = 'RECURRING',
  ONE_TIME = 'ONE_TIME',
}

export enum ExpenseFrequency {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum YearlyPaymentStrategy {
  FULL = 'FULL',
  INSTALLMENTS = 'INSTALLMENTS',
}

export enum InstallmentFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
}

export enum ApprovalAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}
