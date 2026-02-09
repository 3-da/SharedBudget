import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChangePasswordFormComponent } from './change-password-form.component';

describe('ChangePasswordFormComponent', () => {
  let component: ChangePasswordFormComponent;
  let fixture: ComponentFixture<ChangePasswordFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAnimationsAsync()],
    });
    fixture = TestBed.createComponent(ChangePasswordFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should require minimum 8 characters for new password', () => {
    component.form.patchValue({ currentPassword: 'old', newPassword: 'short', confirmPassword: 'short' });
    expect(component.form.get('newPassword')!.hasError('minlength')).toBe(true);
  });

  it('should accept 8+ character password', () => {
    component.form.patchValue({ newPassword: 'longpassword' });
    expect(component.form.get('newPassword')!.hasError('minlength')).toBe(false);
  });

  it('should show passwordMismatch when passwords differ', () => {
    component.form.patchValue({
      currentPassword: 'old',
      newPassword: 'password123',
      confirmPassword: 'different123',
    });
    expect(component.form.hasError('passwordMismatch')).toBe(true);
  });

  it('should not show passwordMismatch when passwords match', () => {
    component.form.patchValue({
      currentPassword: 'old',
      newPassword: 'password123',
      confirmPassword: 'password123',
    });
    expect(component.form.hasError('passwordMismatch')).toBe(false);
  });

  it('should emit save with correct DTO on valid submit', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith({
      currentPassword: 'oldpass123',
      newPassword: 'newpass123',
    });
  });

  it('should not emit when form is invalid', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);
    component.onSubmit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should reset form after submit', () => {
    component.form.patchValue({
      currentPassword: 'old',
      newPassword: 'newpass123',
      confirmPassword: 'newpass123',
    });
    component.onSubmit();
    expect(component.form.get('currentPassword')!.value).toBe('');
  });
});
