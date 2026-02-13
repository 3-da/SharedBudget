import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PasswordFieldComponent } from '../components/password-field.component';
import { AuthService } from '../../../core/auth/auth.service';
import { passwordMatchValidator } from '../../../shared/validators/password-match.validator';

@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatProgressBarModule, PasswordFieldComponent,
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>Create Account</mat-card-title>
          <mat-card-subtitle>Join SharedBudget</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="name-row">
              <mat-form-field appearance="outline">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="firstName">
                <mat-error>Required</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="lastName">
                <mat-error>Required</mat-error>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email" autocomplete="email">
              <mat-error>
                @if (form.controls.email.hasError('required')) { Email is required }
                @else if (form.controls.email.hasError('email')) { Invalid email }
              </mat-error>
            </mat-form-field>
            <app-password-field [control]="form.controls.password" />
            <app-password-field label="Confirm Password" [control]="form.controls.confirmPassword" />
            @if (form.hasError('passwordMismatch')) {
              <p class="error-text">Passwords do not match</p>
            }
            <button mat-flat-button type="submit" class="full-width submit-btn" [disabled]="loading()">
              Create Account
            </button>
          </form>
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button routerLink="/auth/login">Already have an account?</a>
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
    .auth-card { max-width: 480px; width: 100%; }
    .full-width { width: 100%; }
    .name-row { display: flex; gap: var(--space-md); }
    .name-row mat-form-field { flex: 1; }
    .submit-btn { margin-top: var(--space-md); height: 48px; font-size: 1rem; }
    .error-text { color: var(--color-negative); font-size: 0.8rem; margin: -8px 0 8px; }
    mat-card-content { padding: var(--space-md) var(--space-lg); }
  `],
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  loading = signal(false);

  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    confirmPassword: ['', [Validators.required]],
  }, { validators: passwordMatchValidator });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    const { confirmPassword, ...dto } = this.form.getRawValue();
    this.authService.register(dto).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.snackBar.open('Verification code sent!', 'OK', { duration: 3000, panelClass: 'success-snackbar' });
        this.router.navigate(['/auth/verify-code'], { queryParams: { email: dto.email } });
      },
      error: err => {
        this.loading.set(false);
        const msg = err.error?.message || 'Registration failed';
        this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      },
    });
  }
}
