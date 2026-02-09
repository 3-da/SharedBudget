import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { TokenService } from './token.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenService: TokenService;
  let authService: AuthService;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenService = TestBed.inject(TokenService);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => httpMock.verify());

  it('should skip auth endpoints (no Authorization header)', () => {
    http.post(`${baseUrl}/auth/login`, {}).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should attach Bearer token to non-auth requests', () => {
    tokenService.setAccessToken('test-token');
    http.get(`${baseUrl}/users/me`).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/users/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush({});
  });

  it('should not attach token when none exists', () => {
    http.get(`${baseUrl}/users/me`).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/users/me`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should attempt refresh on 401 and retry', () => {
    tokenService.setAccessToken('expired');
    tokenService.setRefreshToken('valid-refresh');

    http.get(`${baseUrl}/salary/me`).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/salary/me`);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${baseUrl}/auth/refresh`);
    refreshReq.flush({ accessToken: 'new-at', refreshToken: 'new-rt' });

    const retryReq = httpMock.expectOne(`${baseUrl}/salary/me`);
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-at');
    retryReq.flush({ amount: 100 });
  });

  it('should clear auth on refresh failure', () => {
    const clearSpy = vi.spyOn(authService, 'clearAuth');
    tokenService.setAccessToken('expired');
    tokenService.setRefreshToken('bad-refresh');

    http.get(`${baseUrl}/salary/me`).subscribe({ error: () => {} });
    const req = httpMock.expectOne(`${baseUrl}/salary/me`);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${baseUrl}/auth/refresh`);
    refreshReq.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(clearSpy).toHaveBeenCalled();
  });
});
