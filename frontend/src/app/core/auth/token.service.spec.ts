import { TestBed } from '@angular/core/testing';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenService);
  });

  afterEach(() => localStorage.clear());

  describe('access token (memory)', () => {
    it('should return null initially', () => {
      expect(service.getAccessToken()).toBeNull();
    });

    it('should store and retrieve access token', () => {
      service.setAccessToken('abc123');
      expect(service.getAccessToken()).toBe('abc123');
    });

    it('should clear access token', () => {
      service.setAccessToken('abc123');
      service.clearTokens();
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('refresh token (localStorage)', () => {
    it('should return null initially', () => {
      expect(service.getRefreshToken()).toBeNull();
    });

    it('should store and retrieve refresh token', () => {
      service.setRefreshToken('refresh-xyz');
      expect(service.getRefreshToken()).toBe('refresh-xyz');
    });

    it('should clear refresh token', () => {
      service.setRefreshToken('refresh-xyz');
      service.clearTokens();
      expect(service.getRefreshToken()).toBeNull();
    });
  });

  describe('isAccessTokenExpired', () => {
    it('should return true when no token exists', () => {
      expect(service.isAccessTokenExpired()).toBe(true);
    });

    it('should return true for expired token', () => {
      const expiredPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }));
      service.setAccessToken(`header.${expiredPayload}.sig`);
      expect(service.isAccessTokenExpired()).toBe(true);
    });

    it('should return false for valid token', () => {
      const futurePayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      service.setAccessToken(`header.${futurePayload}.sig`);
      expect(service.isAccessTokenExpired()).toBe(false);
    });

    it('should return true for malformed token', () => {
      service.setAccessToken('not-a-jwt');
      expect(service.isAccessTokenExpired()).toBe(true);
    });
  });
});
