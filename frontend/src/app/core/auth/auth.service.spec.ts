import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { StoreResetService } from '../stores/store-reset.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokenService: TokenService;
  let router: Router;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: StoreResetService, useValue: { resetAll: vi.fn() } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(TokenService);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpMock.verify());

  describe('login', () => {
    it('should store access token on successful login', () => {
      const spy = vi.spyOn(tokenService, 'setAccessToken');

      service.login({ email: 'a@b.com', password: 'pass' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/login`);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ accessToken: 'at' });

      expect(spy).toHaveBeenCalledWith('at');
    });
  });

  describe('logout', () => {
    it('should clear tokens, null user, navigate to login', () => {
      const clearSpy = vi.spyOn(tokenService, 'clearTokens');
      const navSpy = vi.spyOn(router, 'navigate');

      service.logout().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/logout`);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ message: 'ok' });

      expect(clearSpy).toHaveBeenCalled();
      expect(service.currentUser()).toBeNull();
      expect(navSpy).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('register', () => {
    it('should call register endpoint', () => {
      service.register({ email: 'a@b.com', password: 'pass', firstName: 'A', lastName: 'B' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/register`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'ok' });
    });
  });

  describe('verifyCode', () => {
    it('should call verify-code and store access token', () => {
      const spy = vi.spyOn(tokenService, 'setAccessToken');
      service.verifyCode({ email: 'a@b.com', code: '123456' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/verify-code`);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ accessToken: 'at' });
      expect(spy).toHaveBeenCalledWith('at');
    });
  });

  describe('refresh', () => {
    it('should send empty body with credentials', () => {
      const spy = vi.spyOn(tokenService, 'setAccessToken');
      service.refresh().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/refresh`);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toEqual({});
      req.flush({ accessToken: 'new-at' });
      expect(spy).toHaveBeenCalledWith('new-at');
    });
  });

  describe('resendCode', () => {
    it('should call resend-code endpoint', () => {
      service.resendCode({ email: 'a@b.com' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/resend-code`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'ok' });
    });
  });

  describe('forgotPassword', () => {
    it('should call forgot-password endpoint', () => {
      service.forgotPassword({ email: 'a@b.com' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/forgot-password`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'ok' });
    });
  });

  describe('resetPassword', () => {
    it('should call reset-password endpoint', () => {
      service.resetPassword({ token: 'tok', newPassword: 'newpass' }).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/auth/reset-password`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'ok' });
    });
  });

  describe('loadCurrentUser', () => {
    it('should set currentUser signal', () => {
      const user = { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', emailVerified: true, createdAt: '2025-01-01' };
      service.loadCurrentUser().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/users/me`);
      req.flush(user);
      expect(service.currentUser()).toEqual(user);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no user', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return true after loadCurrentUser', () => {
      service.loadCurrentUser().subscribe();
      const req = httpMock.expectOne(`${baseUrl}/users/me`);
      req.flush({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', emailVerified: true, createdAt: '2025-01-01' });
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('should clear tokens and null user', () => {
      const clearSpy = vi.spyOn(tokenService, 'clearTokens');
      service.clearAuth();
      expect(clearSpy).toHaveBeenCalled();
      expect(service.currentUser()).toBeNull();
    });
  });
});
