import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { GlobalErrorHandler } from './core/error/error-handler.service';
import { AuthService } from './core/auth/auth.service';
import { TokenService } from './core/auth/token.service';
import { catchError, of, switchMap } from 'rxjs';

function initializeAuth(): void {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);

  if (tokenService.getRefreshToken()) {
    // On reload, access token is lost (in-memory). Refresh first to get a new one,
    // then load the user profile with the fresh token.
    authService.refresh().pipe(
      switchMap(() => authService.loadCurrentUser()),
      catchError(() => of(null)),
    ).subscribe();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(initializeAuth),
  ],
};
