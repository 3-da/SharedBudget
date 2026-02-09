import { Routes } from '@angular/router';

export const APPROVAL_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/approval-list.component').then(m => m.ApprovalListComponent) },
];
