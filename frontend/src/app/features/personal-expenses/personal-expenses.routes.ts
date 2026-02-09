import { Routes } from '@angular/router';

export const PERSONAL_EXPENSE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/personal-expense-list.component').then(m => m.PersonalExpenseListComponent) },
  { path: 'new', loadComponent: () => import('./pages/personal-expense-form-page.component').then(m => m.PersonalExpenseFormPageComponent) },
  { path: ':id/edit', loadComponent: () => import('./pages/personal-expense-form-page.component').then(m => m.PersonalExpenseFormPageComponent) },
  { path: ':id/timeline', loadComponent: () => import('./pages/recurring-timeline.component').then(m => m.RecurringTimelineComponent) },
];
