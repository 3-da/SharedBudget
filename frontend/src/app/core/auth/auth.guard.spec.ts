import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { StoreResetService } from '../stores/store-reset.service';

describe('authGuard', () => {
  let authService: AuthService;
  let router: Router;
  const mockRoute = {} as ActivatedRouteSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: StoreResetService, useValue: { resetAll: vi.fn() } },
      ],
    });
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    // Simulate session restore already completed so guard doesn't wait forever
    authService.tryRestoreSession = vi.fn();
    (authService as any).restoreResolve?.();
  });

  it('should allow access when user is authenticated', async () => {
    authService.currentUser.set({ id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B' } as any);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('should redirect to /auth/login when not authenticated', async () => {
    authService.currentUser.set(null);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/dashboard' } as RouterStateSnapshot),
    );
    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/auth/login');
  });

  it('should pass returnUrl as query param', async () => {
    authService.currentUser.set(null);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(mockRoute, { url: '/expenses/personal' } as RouterStateSnapshot),
    );
    const tree = result as UrlTree;
    expect(tree.queryParams['returnUrl']).toBe('/expenses/personal');
  });
});
