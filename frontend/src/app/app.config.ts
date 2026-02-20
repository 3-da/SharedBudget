import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { GlobalErrorHandler } from './core/error/error-handler.service';
import { AuthService } from './core/auth/auth.service';

function initializeAuth(): void {
  const authService = inject(AuthService);
  // Non-blocking: kicks off refresh + loadUser in background.
  // The auth guard awaits authService.restored before checking auth state.
  authService.tryRestoreSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(initializeAuth),
  ],
};
