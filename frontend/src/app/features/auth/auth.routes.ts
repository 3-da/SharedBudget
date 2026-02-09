import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register.component').then(m => m.RegisterComponent) },
  { path: 'verify-code', loadComponent: () => import('./pages/verify-code.component').then(m => m.VerifyCodeComponent) },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password.component').then(m => m.ResetPasswordComponent) },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
