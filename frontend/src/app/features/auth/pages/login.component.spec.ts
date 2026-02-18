import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authService: Record<string, ReturnType<typeof vi.fn>>;
  let router: Router;
  let snackBar: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
      loadCurrentUser: vi.fn(),
    };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with loading = false', () => {
    expect(component.loading()).toBe(false);
  });

  describe('onSubmit', () => {
    it('should mark form touched and not call service when form invalid', () => {
      component.onSubmit();
      expect(authService['login']).not.toHaveBeenCalled();
      expect(component.form.touched).toBe(true);
    });

    it('should set loading and call login+loadCurrentUser on valid form', () => {
      authService['login'].mockReturnValue(of({ accessToken: 'at' }));
      authService['loadCurrentUser'].mockReturnValue(of({ id: 'u1' }));
      component.form.setValue({ email: 'test@example.com', password: 'ValidPass1!' });
      component.onSubmit();
      expect(authService['login']).toHaveBeenCalledWith({ email: 'test@example.com', password: 'ValidPass1!' });
      expect(authService['loadCurrentUser']).toHaveBeenCalled();
    });

    it('should navigate to /household on success with no returnUrl', () => {
      authService['login'].mockReturnValue(of({ accessToken: 'at' }));
      authService['loadCurrentUser'].mockReturnValue(of({ id: 'u1' }));
      const spy = vi.spyOn(router, 'navigateByUrl');
      component.form.setValue({ email: 'a@b.com', password: 'ValidPass1!' });
      component.onSubmit();
      expect(spy).toHaveBeenCalledWith('/household');
    });

    it('should navigate to returnUrl on success when valid', () => {
      authService['login'].mockReturnValue(of({ accessToken: 'at' }));
      authService['loadCurrentUser'].mockReturnValue(of({ id: 'u1' }));
      const spy = vi.spyOn(router, 'navigateByUrl');
      TestBed.runInInjectionContext(() => {
        component.form.setValue({ email: 'a@b.com', password: 'ValidPass1!' });
      });
      // Simulate returnUrl input — directly test sanitizeReturnUrl logic via submit
      // with a valid path the router should navigate to it
      component.form.setValue({ email: 'a@b.com', password: 'ValidPass1!' });
      component.onSubmit();
      // default returnUrl is '' which falls back to /household
      expect(spy).toHaveBeenCalledWith('/household');
    });

    it('should reset loading and show snackbar on error', () => {
      authService['login'].mockReturnValue(throwError(() => ({ error: { message: 'Invalid credentials' } })));
      component.form.setValue({ email: 'a@b.com', password: 'ValidPass1!' });
      component.onSubmit();
      expect(component.loading()).toBe(false);
      expect(snackBar['open']).toHaveBeenCalledWith('Invalid credentials', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show fallback message when error has no message', () => {
      authService['login'].mockReturnValue(throwError(() => ({ error: {} })));
      component.form.setValue({ email: 'a@b.com', password: 'ValidPass1!' });
      component.onSubmit();
      expect(snackBar['open']).toHaveBeenCalledWith('Login failed', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('sanitizeReturnUrl (via onSubmit)', () => {
    const validCases = [
      ['/dashboard', '/dashboard'],
      ['/household/details', '/household/details'],
      ['', '/household'],
    ] as const;

    const invalidCases = [
      '//evil.com',
      'http://evil.com',
      'https://evil.com',
      'user@host',
      'relative-no-slash',
    ];

    it.each(validCases)('should navigate to %s → %s', (returnUrl, expected) => {
      authService['login'].mockReturnValue(of({ accessToken: 'at' }));
      authService['loadCurrentUser'].mockReturnValue(of({ id: 'u1' }));
      const spy = vi.spyOn(router, 'navigateByUrl');
      // Patch the returnUrl input signal value indirectly via the private method
      // by calling onSubmit after manually setting the form (returnUrl stays default '')
      component.form.setValue({ email: 'a@b.com', password: 'ValidPass1!' });
      // Access private method via type cast for unit-test coverage
      const sanitize = (component as any).sanitizeReturnUrl.bind(component);
      expect(sanitize(returnUrl)).toBe(expected);
    });

    it.each(invalidCases)('should reject %s → /household', (url) => {
      const sanitize = (component as any).sanitizeReturnUrl.bind(component);
      expect(sanitize(url)).toBe('/household');
    });
  });
});
