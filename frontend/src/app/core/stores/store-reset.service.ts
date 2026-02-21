import { inject, Injectable, Injector } from '@angular/core';
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
  private readonly injector = inject(Injector);

  resetAll(): void {
    this.injector.get(NotificationStore).reset();
    this.injector.get(ApprovalStore).reset();
    this.injector.get(DashboardStore).reset();
    this.injector.get(HouseholdStore).reset();
    this.injector.get(PersonalExpenseStore).reset();
    this.injector.get(SalaryStore).reset();
    this.injector.get(SavingStore).reset();
    this.injector.get(SharedExpenseStore).reset();
  }
}
