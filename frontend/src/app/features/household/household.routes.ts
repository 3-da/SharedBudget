import { Routes } from '@angular/router';

export const HOUSEHOLD_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/household-detail.component').then(m => m.HouseholdDetailComponent) },
  { path: 'invitations', loadComponent: () => import('./pages/pending-invitations.component').then(m => m.PendingInvitationsComponent) },
  { path: 'members/:userId', loadComponent: () => import('./pages/member-detail.component').then(m => m.MemberDetailComponent) },
];
