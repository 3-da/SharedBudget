import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { switchMap } from 'rxjs';
import { PasswordFieldComponent } from '../components/password-field.component';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, MatCardModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatProgressBarModule, MatIconModule, PasswordFieldComponent,
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>Welcome Back</mat-card-title>
          <mat-card-subtitle>Sign in to SharedBudget</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <mat-card-content>
          @if (showWakeUpMessage()) {
            <div class="wake-up-banner" role="status" aria-live="polite">
              <mat-icon aria-hidden="true" class="wake-icon">bedtime</mat-icon>
              <div class="wake-up-text">
                <strong>Server is waking up&hellip;</strong>
                <span>The free-tier server was sleeping. First login can take up to 2&nbsp;minutes. Please wait.</span>
              </div>
            </div>
          }
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email" autocomplete="email">
              <mat-error>
                @if (form.controls.email.hasError('required')) { Email is required }
                @else if (form.controls.email.hasError('email')) { Invalid email }
              </mat-error>
            </mat-form-field>
            <app-password-field [control]="form.controls.password" />
            <button mat-flat-button type="submit" class="full-width submit-btn" [disabled]="loading()">
              Sign In
            </button>
          </form>
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button routerLink="/auth/register">Create an account</a>
          <a mat-button routerLink="/auth/forgot-password">Forgot password?</a>
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
    .submit-btn { margin-top: var(--space-md); height: 48px; font-size: 1rem; }
    mat-card-content { padding: var(--space-md) var(--space-lg); }
    .wake-up-banner {
      display: flex; align-items: flex-start; gap: var(--space-sm);
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      border-radius: 8px; padding: var(--space-sm) var(--space-md);
      margin-bottom: var(--space-md);
      animation: fadeIn 0.3s ease;
    }
    .wake-up-text { display: flex; flex-direction: column; gap: 2px; font-size: 0.875rem; }
    .wake-up-text strong { font-size: 0.9rem; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  `],
})
export class LoginComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  loading = signal(false);
  showWakeUpMessage = signal(false);
  readonly returnUrl = input<string>('');

  private wakeUpTimer: ReturnType<typeof setTimeout> | null = null;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  ngOnDestroy(): void {
    if (this.wakeUpTimer) clearTimeout(this.wakeUpTimer);
  }

  private sanitizeReturnUrl(url: string): string {
    if (!url || url.startsWith('//') || url.includes('@') || /^https?:/i.test(url)) {
      return '/household';
    }
    return url.startsWith('/') ? url : '/household';
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.showWakeUpMessage.set(false);

    // Show wake-up message if response takes more than 4 seconds
    this.wakeUpTimer = setTimeout(() => {
      if (this.loading()) this.showWakeUpMessage.set(true);
    }, 4000);

    this.authService.login(this.form.getRawValue()).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.clearWakeUpTimer();
        this.router.navigateByUrl(this.sanitizeReturnUrl(this.returnUrl()));
      },
      error: err => {
        this.clearWakeUpTimer();
        this.loading.set(false);
        const msg = err.error?.message || 'Login failed';
        this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      },
    });
  }

  private clearWakeUpTimer(): void {
    if (this.wakeUpTimer) {
      clearTimeout(this.wakeUpTimer);
      this.wakeUpTimer = null;
    }
    this.showWakeUpMessage.set(false);
  }
}
