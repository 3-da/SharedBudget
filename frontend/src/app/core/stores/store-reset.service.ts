import { inject, Injectable } from '@angular/core';
import { NotificationStore } from './notification.store';
import { ApprovalStore } from '../../features/approvals/stores/approval.store';
import { DashboardStore } from '../../features/dashboard/stores/dashboard.store';
import { HouseholdStore } from '../../features/household/stores/household.store';
import { PersonalExpenseStore } from '../../features/personal-expenses/stores/personal-expense.store';
import { SalaryStore } from '../../features/salary/stores/salary.store';
import { SavingStore } from '../../features/savings/stores/saving.store';
import { SharedExpenseStore } from '../../features/shared-expenses/stores/shared-expense.store';

@Injectable({ providedIn: 'root' })
export class StoreResetService {
  private readonly notificationStore = inject(NotificationStore);
  private readonly approvalStore = inject(ApprovalStore);
  private readonly dashboardStore = inject(DashboardStore);
  private readonly householdStore = inject(HouseholdStore);
  private readonly personalExpenseStore = inject(PersonalExpenseStore);
  private readonly salaryStore = inject(SalaryStore);
  private readonly savingStore = inject(SavingStore);
  private readonly sharedExpenseStore = inject(SharedExpenseStore);

  resetAll(): void {
    this.notificationStore.reset();
    this.approvalStore.reset();
    this.dashboardStore.reset();
    this.householdStore.reset();
    this.personalExpenseStore.reset();
    this.salaryStore.reset();
    this.savingStore.reset();
    this.sharedExpenseStore.reset();
  }
}
