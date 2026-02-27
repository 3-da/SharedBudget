import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private accessToken: string | null = null;

  /** Called once at app startup to hydrate in-memory cache from Preferences */
  async loadToken(): Promise<void> {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    this.accessToken = value ?? null;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async setAccessToken(token: string): Promise<void> {
    this.accessToken = token;
    await Preferences.set({ key: TOKEN_KEY, value: token });
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    await Preferences.remove({ key: TOKEN_KEY });
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
