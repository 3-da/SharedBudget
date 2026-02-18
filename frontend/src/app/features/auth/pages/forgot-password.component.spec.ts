import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthService } from '../../../core/auth/auth.service';
import { StoreResetService } from '../../../core/stores/store-reset.service';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let authService: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    authService = { forgotPassword: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: authService },
        { provide: StoreResetService, useValue: { resetAll: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with loading = false and sent = false', () => {
    expect(component.loading()).toBe(false);
    expect(component.sent()).toBe(false);
  });

  describe('onSubmit', () => {
    it('should mark form touched and not call service when form invalid', () => {
      component.onSubmit();
      expect(authService['forgotPassword']).not.toHaveBeenCalled();
      expect(component.form.touched).toBe(true);
    });

    it('should call forgotPassword on valid form', () => {
      authService['forgotPassword'].mockReturnValue(of({ message: 'ok' }));
      component.form.setValue({ email: 'a@b.com' });
      component.onSubmit();
      expect(authService['forgotPassword']).toHaveBeenCalledWith({ email: 'a@b.com' });
    });

    it('should set sent = true and loading = false on success', () => {
      authService['forgotPassword'].mockReturnValue(of({ message: 'ok' }));
      component.form.setValue({ email: 'a@b.com' });
      component.onSubmit();
      expect(component.sent()).toBe(true);
      expect(component.loading()).toBe(false);
    });

    it('should set sent = true on error (prevents email enumeration)', () => {
      authService['forgotPassword'].mockReturnValue(throwError(() => new Error()));
      component.form.setValue({ email: 'nonexistent@b.com' });
      component.onSubmit();
      // Same response on error as on success — no leak of whether email exists
      expect(component.sent()).toBe(true);
      expect(component.loading()).toBe(false);
    });
  });
});
