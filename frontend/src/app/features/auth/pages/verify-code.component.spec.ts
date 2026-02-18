import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { VerifyCodeComponent } from './verify-code.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('VerifyCodeComponent', () => {
  let component: VerifyCodeComponent;
  let authService: Record<string, ReturnType<typeof vi.fn>>;
  let router: Router;
  let snackBar: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    authService = {
      verifyCode: vi.fn(),
      loadCurrentUser: vi.fn(),
      resendCode: vi.fn(),
    };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [VerifyCodeComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VerifyCodeComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with loading = false, codeExpiry = 600, resendCooldown = 0', () => {
    expect(component.loading()).toBe(false);
    expect(component.codeExpiry()).toBe(600);
    expect(component.resendCooldown()).toBe(0);
  });

  describe('expiryDisplay computed', () => {
    it('should format 600s as 10:00', () => {
      expect(component.expiryDisplay()).toBe('10:00');
    });

    it('should format 65s as 1:05', () => {
      component.codeExpiry.set(65);
      expect(component.expiryDisplay()).toBe('1:05');
    });

    it('should format 9s as 0:09', () => {
      component.codeExpiry.set(9);
      expect(component.expiryDisplay()).toBe('0:09');
    });

    it('should format 0s as 0:00', () => {
      component.codeExpiry.set(0);
      expect(component.expiryDisplay()).toBe('0:00');
    });
  });

  describe('onCodeComplete', () => {
    it('should call verifyCode and loadCurrentUser on success', () => {
      authService['verifyCode'].mockReturnValue(of({ accessToken: 'at' }));
      authService['loadCurrentUser'].mockReturnValue(of({ id: 'u1' }));
      component.onCodeComplete('123456');
      expect(authService['verifyCode']).toHaveBeenCalledWith({ email: '', code: '123456' });
      expect(authService['loadCurrentUser']).toHaveBeenCalled();
    });

    it('should navigate to /household on success', () => {
      authService['verifyCode'].mockReturnValue(of({ accessToken: 'at' }));
      authService['loadCurrentUser'].mockReturnValue(of({ id: 'u1' }));
      const navSpy = vi.spyOn(router, 'navigate');
      component.onCodeComplete('123456');
      expect(navSpy).toHaveBeenCalledWith(['/household']);
    });

    it('should reset loading and show error snackbar on generic error', () => {
      authService['verifyCode'].mockReturnValue(throwError(() => ({ status: 400, error: { message: 'Invalid code' } })));
      component.onCodeComplete('000000');
      expect(component.loading()).toBe(false);
      expect(snackBar['open']).toHaveBeenCalledWith('Invalid code', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show rate-limit message on 429 error', () => {
      authService['verifyCode'].mockReturnValue(throwError(() => ({ status: 429, error: {} })));
      component.onCodeComplete('000000');
      expect(snackBar['open']).toHaveBeenCalledWith(
        'Too many attempts. Please wait a few minutes.', 'Close', { duration: 5000, panelClass: 'error-snackbar' },
      );
    });

    it('should show fallback message when no error message', () => {
      authService['verifyCode'].mockReturnValue(throwError(() => ({ status: 400, error: {} })));
      component.onCodeComplete('000000');
      expect(snackBar['open']).toHaveBeenCalledWith('Invalid or expired code', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });

  describe('resendCode', () => {
    it('should call resendCode service method', () => {
      authService['resendCode'].mockReturnValue(of({ message: 'Code sent' }));
      component.resendCode();
      expect(authService['resendCode']).toHaveBeenCalledWith({ email: '' });
    });

    it('should show success snackbar and reset timers on success', () => {
      authService['resendCode'].mockReturnValue(of({ message: 'Code sent' }));
      component.codeExpiry.set(100);
      component.resendCode();
      expect(snackBar['open']).toHaveBeenCalledWith('Code sent', 'OK', { duration: 3000, panelClass: 'success-snackbar' });
      expect(component.codeExpiry()).toBe(600);
      expect(component.resendCooldown()).toBe(60);
    });

    it('should show rate-limit error on 429', () => {
      authService['resendCode'].mockReturnValue(throwError(() => ({ status: 429, error: {} })));
      component.resendCode();
      expect(snackBar['open']).toHaveBeenCalledWith(
        'Too many resend attempts. Please wait before trying again.', 'Close', { duration: 5000, panelClass: 'error-snackbar' },
      );
    });

    it('should show fallback error message on generic failure', () => {
      authService['resendCode'].mockReturnValue(throwError(() => ({ status: 500, error: {} })));
      component.resendCode();
      expect(snackBar['open']).toHaveBeenCalledWith('Failed to resend code', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });
});
