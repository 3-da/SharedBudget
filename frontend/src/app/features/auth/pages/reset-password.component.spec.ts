import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ResetPasswordComponent } from './reset-password.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let authService: Record<string, ReturnType<typeof vi.fn>>;
  let router: Router;
  let snackBar: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    authService = { resetPassword: vi.fn() };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with loading = false', () => {
    expect(component.loading()).toBe(false);
  });

  describe('form validation', () => {
    it('should be invalid when empty', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should have passwordMismatch error when passwords differ', () => {
      component.form.setValue({ password: 'ValidPass1!', confirmPassword: 'Different1!' });
      expect(component.form.hasError('passwordMismatch')).toBe(true);
    });

    it('should be valid when passwords match', () => {
      component.form.setValue({ password: 'ValidPass1!', confirmPassword: 'ValidPass1!' });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should mark form touched and not call service when form invalid', () => {
      component.onSubmit();
      expect(authService['resetPassword']).not.toHaveBeenCalled();
      expect(component.form.touched).toBe(true);
    });

    it('should call resetPassword with token and password only', () => {
      authService['resetPassword'].mockReturnValue(of({ message: 'ok' }));
      component.form.setValue({ password: 'ValidPass1!', confirmPassword: 'ValidPass1!' });
      component.onSubmit();
      // token input defaults to ''
      expect(authService['resetPassword']).toHaveBeenCalledWith({ token: '', newPassword: 'ValidPass1!' });
    });

    it('should show success snackbar and navigate to login on success', () => {
      authService['resetPassword'].mockReturnValue(of({ message: 'ok' }));
      const navSpy = vi.spyOn(router, 'navigate');
      component.form.setValue({ password: 'ValidPass1!', confirmPassword: 'ValidPass1!' });
      component.onSubmit();
      expect(snackBar['open']).toHaveBeenCalledWith('Password reset successful. Please log in.', 'OK', { duration: 5000, panelClass: 'success-snackbar' });
      expect(navSpy).toHaveBeenCalledWith(['/auth/login']);
    });

    it('should reset loading and show error snackbar on failure', () => {
      authService['resetPassword'].mockReturnValue(throwError(() => ({ error: { message: 'Token expired' } })));
      component.form.setValue({ password: 'ValidPass1!', confirmPassword: 'ValidPass1!' });
      component.onSubmit();
      expect(component.loading()).toBe(false);
      expect(snackBar['open']).toHaveBeenCalledWith('Token expired', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show fallback expired message when no error message', () => {
      authService['resetPassword'].mockReturnValue(throwError(() => ({ error: {} })));
      component.form.setValue({ password: 'ValidPass1!', confirmPassword: 'ValidPass1!' });
      component.onSubmit();
      expect(snackBar['open']).toHaveBeenCalledWith('Reset failed. The link may have expired.', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });
});
