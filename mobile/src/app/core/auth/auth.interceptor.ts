import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/verify-code', '/auth/resend-code', '/auth/forgot-password', '/auth/reset-password'];

function isAuthUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return AUTH_PATHS.some(p => pathname.endsWith(p));
  } catch {
    return AUTH_PATHS.some(p => url.endsWith(p));
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  if (isAuthUrl(req.url)) {
    return next(req);
  }

  const token = tokenService.getAccessToken();
  const authedReq = token ? addToken(req, token) : req;

  return next(authedReq).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handle401(req, next, tokenService, authService);
      }
      return throwError(() => error);
    }),
  );
};

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  tokenService: TokenService,
  authService: AuthService,
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refresh().pipe(
      switchMap(res => {
        isRefreshing = false;
        refreshTokenSubject.next(res.accessToken);
        return next(addToken(req, res.accessToken));
      }),
      catchError(err => {
        isRefreshing = false;
        authService.clearAuth();
        inject(Router).navigate(['/auth/login']);
        return throwError(() => err);
      }),
    );
  }

  return refreshTokenSubject.pipe(
    filter(token => token !== null),
    take(1),
    switchMap(token => next(addToken(req, token!))),
  );
}
