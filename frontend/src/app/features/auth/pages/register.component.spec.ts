import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let authService: Record<string, ReturnType<typeof vi.fn>>;
  let router: Router;
  let snackBar: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    authService = { register: vi.fn() };
    snackBar = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterComponent);
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

    it('should be invalid with mismatched passwords', () => {
      component.form.setValue({
        firstName: 'Alex', lastName: 'A',
        email: 'a@b.com', password: 'ValidPass1!', confirmPassword: 'Different1!',
      });
      expect(component.form.hasError('passwordMismatch')).toBe(true);
    });

    it('should be valid with all correct fields', () => {
      component.form.setValue({
        firstName: 'Alex', lastName: 'A',
        email: 'a@b.com', password: 'ValidPass1!', confirmPassword: 'ValidPass1!',
      });
      expect(component.form.valid).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('should mark form touched and not call service when form invalid', () => {
      component.onSubmit();
      expect(authService['register']).not.toHaveBeenCalled();
      expect(component.form.touched).toBe(true);
    });

    it('should call register without confirmPassword', () => {
      authService['register'].mockReturnValue(of({ message: 'ok' }));
      component.form.setValue({
        firstName: 'Alex', lastName: 'A',
        email: 'a@b.com', password: 'ValidPass1!', confirmPassword: 'ValidPass1!',
      });
      component.onSubmit();
      expect(authService['register']).toHaveBeenCalledWith({
        firstName: 'Alex', lastName: 'A', email: 'a@b.com', password: 'ValidPass1!',
      });
    });

    it('should show success snackbar and navigate to verify-code on success', () => {
      authService['register'].mockReturnValue(of({ message: 'ok' }));
      const navSpy = vi.spyOn(router, 'navigate');
      component.form.setValue({
        firstName: 'Alex', lastName: 'A',
        email: 'a@b.com', password: 'ValidPass1!', confirmPassword: 'ValidPass1!',
      });
      component.onSubmit();
      expect(snackBar['open']).toHaveBeenCalledWith('Verification code sent!', 'OK', { duration: 3000, panelClass: 'success-snackbar' });
      expect(navSpy).toHaveBeenCalledWith(['/auth/verify-code'], { queryParams: { email: 'a@b.com' } });
    });

    it('should reset loading and show error snackbar on failure', () => {
      authService['register'].mockReturnValue(throwError(() => ({ error: { message: 'Email taken' } })));
      component.form.setValue({
        firstName: 'Alex', lastName: 'A',
        email: 'a@b.com', password: 'ValidPass1!', confirmPassword: 'ValidPass1!',
      });
      component.onSubmit();
      expect(component.loading()).toBe(false);
      expect(snackBar['open']).toHaveBeenCalledWith('Email taken', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });

    it('should show fallback message when error has no message', () => {
      authService['register'].mockReturnValue(throwError(() => ({ error: {} })));
      component.form.setValue({
        firstName: 'Alex', lastName: 'A',
        email: 'a@b.com', password: 'ValidPass1!', confirmPassword: 'ValidPass1!',
      });
      component.onSubmit();
      expect(snackBar['open']).toHaveBeenCalledWith('Registration failed', 'Close', { duration: 5000, panelClass: 'error-snackbar' });
    });
  });
});
