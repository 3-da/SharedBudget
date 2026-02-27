import { Routes } from '@angular/router';
import { TabsComponent } from './tabs.component';

export const tabsRoutes: Routes = [
  {
    path: '',
    component: TabsComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./expenses/expenses.page').then(m => m.ExpensesPage),
      },
      {
        path: 'expenses/personal/new',
        loadComponent: () =>
          import('./expenses/personal-expense-form.page').then(m => m.PersonalExpenseFormPage),
      },
      {
        path: 'expenses/personal/:id/edit',
        loadComponent: () =>
          import('./expenses/personal-expense-form.page').then(m => m.PersonalExpenseFormPage),
      },
      {
        path: 'expenses/shared/new',
        loadComponent: () =>
          import('./expenses/shared-expense-form.page').then(m => m.SharedExpenseFormPage),
      },
      {
        path: 'expenses/shared/:id/edit',
        loadComponent: () =>
          import('./expenses/shared-expense-form.page').then(m => m.SharedExpenseFormPage),
      },
      {
        path: 'household',
        loadComponent: () =>
          import('./household/household.page').then(m => m.HouseholdPage),
      },
      {
        path: 'household/invitations',
        loadComponent: () =>
          import('./household/pending-invitations.page').then(m => m.PendingInvitationsPage),
      },
      {
        path: 'household/members/:userId',
        loadComponent: () =>
          import('./household/member-detail.page').then(m => m.MemberDetailPage),
      },
      {
        path: 'approvals',
        loadComponent: () =>
          import('./approvals/approvals.page').then(m => m.ApprovalsPage),
      },
      {
        path: 'more',
        loadComponent: () =>
          import('./more/more.page').then(m => m.MorePage),
      },
      {
        path: 'more/salary',
        loadComponent: () =>
          import('./more/salary/salary.page').then(m => m.SalaryPage),
      },
      {
        path: 'more/savings',
        loadComponent: () =>
          import('./more/savings/savings.page').then(m => m.SavingsPage),
      },
      {
        path: 'more/settings',
        loadComponent: () =>
          import('./more/settings/settings.page').then(m => m.SettingsPage),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
];
