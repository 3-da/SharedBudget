import { Routes } from '@angular/router';

export const SALARY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/salary-overview.component').then(m => m.SalaryOverviewComponent) },
];
