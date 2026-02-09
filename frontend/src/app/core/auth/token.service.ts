import { Injectable } from '@angular/core';

const REFRESH_TOKEN_KEY = 'sb_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private accessToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch {
      // localStorage not available
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // localStorage not available
    }
  }

  isAccessTokenExpired(): boolean {
    const token = this.accessToken;
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
