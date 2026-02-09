import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'household', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'expenses/personal',
        loadChildren: () => import('./features/personal-expenses/personal-expenses.routes').then(m => m.PERSONAL_EXPENSE_ROUTES),
      },
      {
        path: 'expenses/shared',
        loadChildren: () => import('./features/shared-expenses/shared-expenses.routes').then(m => m.SHARED_EXPENSE_ROUTES),
      },
      {
        path: 'approvals',
        loadChildren: () => import('./features/approvals/approvals.routes').then(m => m.APPROVAL_ROUTES),
      },
      {
        path: 'salary',
        loadChildren: () => import('./features/salary/salary.routes').then(m => m.SALARY_ROUTES),
      },
      {
        path: 'savings',
        loadChildren: () => import('./features/savings/savings.routes').then(m => m.SAVINGS_ROUTES),
      },
      {
        path: 'household',
        loadChildren: () => import('./features/household/household.routes').then(m => m.HOUSEHOLD_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'household' },
];
