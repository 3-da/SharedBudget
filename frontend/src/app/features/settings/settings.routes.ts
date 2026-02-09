import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/settings.component').then(m => m.SettingsComponent) },
];
