import { Routes } from '@angular/router';

export const SAVINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/savings-overview.component').then(m => m.SavingsOverviewComponent),
  },
];
