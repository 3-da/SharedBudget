import { Routes } from '@angular/router';

export const SHARED_EXPENSE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/shared-expense-list.component').then(m => m.SharedExpenseListComponent) },
  { path: 'new', loadComponent: () => import('./pages/shared-expense-form-page.component').then(m => m.SharedExpenseFormPageComponent) },
  { path: ':id/edit', loadComponent: () => import('./pages/shared-expense-form-page.component').then(m => m.SharedExpenseFormPageComponent) },
];
