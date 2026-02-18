import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PasswordFieldComponent } from '../components/password-field.component';
import { AuthService } from '../../../core/auth/auth.service';
import { passwordMatchValidator } from '../../../shared/validators/password-match.validator';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatCardModule, MatButtonModule, MatProgressBarModule, PasswordFieldComponent],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>Reset Password</mat-card-title>
          <mat-card-subtitle>Enter your new password</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <app-password-field label="New Password" [control]="form.controls.password" />
            <app-password-field label="Confirm Password" [control]="form.controls.confirmPassword" />
            @if (form.hasError('passwordMismatch')) {
              <p class="error-text">Passwords do not match</p>
            }
            <button mat-flat-button type="submit" class="full-width submit-btn" [disabled]="loading()">
              Reset Password
            </button>
          </form>
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button routerLink="/auth/login">Back to Login</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--mat-sys-primary-container), var(--mat-sys-surface));
      padding: var(--space-md);
    }
    .auth-card { max-width: 420px; width: 100%; }
    .full-width { width: 100%; }
    .submit-btn { margin-top: var(--space-md); height: 48px; }
    .error-text { color: var(--color-negative); font-size: 0.8rem; margin: -8px 0 8px; }
    mat-card-content { padding: var(--space-md) var(--space-lg); }
  `],
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  loading = signal(false);

  readonly token = input<string>('');

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: passwordMatchValidator });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.authService.resetPassword({ token: this.token(), newPassword: this.form.getRawValue().password }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.snackBar.open('Password reset successful. Please log in.', 'OK', { duration: 5000, panelClass: 'success-snackbar' });
        this.router.navigate(['/auth/login']);
      },
      error: err => {
        this.loading.set(false);
        const msg = err.error?.message || 'Reset failed. The link may have expired.';
        this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      },
    });
  }
}
