import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { TokenService } from './token.service';

describe('authGuard', () => {
  let tokenService: TokenService;
  let router: Router;
  const mockRoute = {} as ActivatedRouteSnapshot;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    tokenService = TestBed.inject(TokenService);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  it('should allow access when access token exists', () => {
    tokenService.setAccessToken('valid-token');
    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('should allow access when refresh token exists', () => {
    tokenService.setRefreshToken('valid-refresh');
    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('should redirect to /auth/login when no tokens', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/auth/login');
  });

  it('should pass returnUrl as query param', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/expenses/personal' } as RouterStateSnapshot),
    );
    const tree = result as UrlTree;
    expect(tree.queryParams['returnUrl']).toBe('/expenses/personal');
  });
});
