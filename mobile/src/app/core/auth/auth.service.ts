import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, switchMap, tap, timeout } from 'rxjs';
import { TokenService } from './token.service';
import { environment } from '../../../environments/environment';
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
  readonly isRestoring = signal(false);

  private restoreResolve: (() => void) | null = null;
  readonly restored = new Promise<void>(resolve => {
    this.restoreResolve = resolve;
  });

  register(dto: RegisterRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/register`, dto, { withCredentials: true });
  }

  verifyCode(dto: VerifyCodeRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/verify-code`, dto, {
      withCredentials: true,
    }).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  resendCode(dto: ResendCodeRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/resend-code`, dto, { withCredentials: true });
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
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/forgot-password`, dto, { withCredentials: true });
  }

  resetPassword(dto: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/reset-password`, dto, { withCredentials: true });
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`, { withCredentials: true }).pipe(
      tap(user => this.currentUser.set(user)),
    );
  }

  /**
   * Attempts to restore the session by loading the token from Preferences,
   * refreshing it, and loading the user. Non-blocking — the app renders
   * immediately while this runs in the background.
   */
  async tryRestoreSession(): Promise<void> {
    this.isRestoring.set(true);
    // Load persisted token from Capacitor Preferences before attempting refresh
    await this.tokenService.loadToken();

    this.refresh().pipe(
      timeout(8000),
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
