import { ApplicationConfig, ErrorHandler, provideZonelessChangeDetection, provideAppInitializer, inject } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { GlobalErrorHandler } from './core/error/error-handler.service';
import { AuthService } from './core/auth/auth.service';

function initializeAuth(): Observable<unknown> {
  const authService = inject(AuthService);

  // On reload, access token is lost (in-memory). Attempt refresh via HttpOnly cookie
  // to get a new one, then load the user profile with the fresh token.
  // If no cookie exists, the refresh call returns 401 and we silently ignore it.
  return authService.refresh().pipe(
    switchMap(() => authService.loadCurrentUser()),
    catchError(() => of(null)),
  );
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
