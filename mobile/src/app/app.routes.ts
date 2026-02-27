import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadChildren: () => import('./features/tabs/tabs.routes').then(m => m.tabsRoutes),
  },
  {
    path: '**',
    redirectTo: '/tabs/dashboard',
  },
];
