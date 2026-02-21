import { InstallmentFrequency } from '../models';

export interface TimelineMonth {
  month: number;
  year: number;
  label: string;
  amount: number;
  isOverride?: boolean;
  isPast: boolean;
  isCurrent: boolean;
}

/** Returns how many installments per year for the given frequency. */
export function getDefaultInstallmentCount(freq: InstallmentFrequency | null | undefined): number {
  switch (freq) {
    case InstallmentFrequency.QUARTERLY: return 4;
    case InstallmentFrequency.SEMI_ANNUAL: return 2;
    case InstallmentFrequency.MONTHLY: default: return 12;
  }
}

/** Returns the number of months between installments for the given frequency. */
export function getStepMonths(freq: InstallmentFrequency | null | undefined): number {
  switch (freq) {
    case InstallmentFrequency.QUARTERLY: return 3;
    case InstallmentFrequency.SEMI_ANNUAL: return 6;
    case InstallmentFrequency.MONTHLY: default: return 1;
  }
}
