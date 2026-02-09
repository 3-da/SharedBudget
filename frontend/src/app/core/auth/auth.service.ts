import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
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
  RefreshTokenRequest,
  MessageResponse,
} from '../../shared/models/auth.model';
import { User } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiUrl;

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isLoading = signal(false);

  register(dto: RegisterRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/register`, dto);
  }

  verifyCode(dto: VerifyCodeRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/verify-code`, dto).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  resendCode(dto: ResendCodeRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/resend-code`, dto);
  }

  login(dto: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, dto).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, {
      refreshToken,
    } as RefreshTokenRequest).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  logout(): Observable<MessageResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/logout`, { refreshToken }).pipe(
      tap(() => {
        this.tokenService.clearTokens();
        this.currentUser.set(null);
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

  clearAuth(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
  }

  private handleAuthResponse(res: AuthResponse): void {
    this.tokenService.setAccessToken(res.accessToken);
    this.tokenService.setRefreshToken(res.refreshToken);
  }
}
