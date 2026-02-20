import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';
import { TokenService } from './token.service';
import { environment } from '../../environments/environment';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  VerifyCodeRequest,
  ResendCodeRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  MessageResponse,
} from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';
import { StoreResetService } from '../stores/store-reset.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly storeReset = inject(StoreResetService);
  private readonly baseUrl = environment.apiUrl;

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isLoading = signal(false);

  /** True while the initial session restore (refresh + loadUser) is in progress */
  readonly isRestoring = signal(false);
  /** Resolves when the initial session restore finishes (success or failure) */
  private restoreResolve: (() => void) | null = null;
  readonly restored = new Promise<void>(resolve => {
    // Will be resolved in constructor via the field initializer timing quirk;
    // reassign in tryRestoreSession
    this.restoreResolve = resolve;
  });

  register(dto: RegisterRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/register`, dto);
  }

  verifyCode(dto: VerifyCodeRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/verify-code`, dto, {
      withCredentials: true,
    }).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  resendCode(dto: ResendCodeRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/resend-code`, dto);
  }

  login(dto: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, dto, {
      withCredentials: true,
    }).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, {}, {
      withCredentials: true,
    }).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  logout(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/logout`, {}, {
      withCredentials: true,
    }).pipe(
      tap(() => {
        this.tokenService.clearTokens();
        this.currentUser.set(null);
        this.storeReset.resetAll();
        this.router.navigate(['/auth/login']);
      }),
    );
  }

  forgotPassword(dto: ForgotPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/forgot-password`, dto);
  }

  resetPassword(dto: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/reset-password`, dto);
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`).pipe(
      tap(user => this.currentUser.set(user)),
    );
  }

  /**
   * Attempts to restore the session by refreshing the token and loading the user.
   * Non-blocking — the app renders immediately while this runs in the background.
   * The auth guard awaits `restored` before making its decision.
   */
  tryRestoreSession(): void {
    this.isRestoring.set(true);
    this.refresh().pipe(
      switchMap(() => this.loadCurrentUser()),
      catchError(() => of(null)),
    ).subscribe({
      next: () => { this.isRestoring.set(false); this.restoreResolve?.(); },
      error: () => { this.isRestoring.set(false); this.restoreResolve?.(); },
    });
  }

  clearAuth(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
    this.storeReset.resetAll();
  }

  private handleAuthResponse(res: AuthResponse): void {
    this.tokenService.setAccessToken(res.accessToken);
  }
}
