import { ChangeDetectionStrategy, Component, inject, input, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { switchMap, interval } from 'rxjs';
import { CodeInputComponent } from '../components/code-input.component';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-verify-code',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatProgressBarModule, MatIconModule, CodeInputComponent],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>Verify Your Email</mat-card-title>
          <mat-card-subtitle>Enter the 6-digit code sent to {{ email() }}</mat-card-subtitle>
        </mat-card-header>
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <mat-card-content>
          <app-code-input (codeComplete)="onCodeComplete($event)" />

          <div class="timer-section">
            @if (codeExpiry() > 0) {
              <span class="timer">
                <mat-icon>timer</mat-icon>
                Code expires in {{ expiryDisplay() }}
              </span>
            } @else {
              <span class="timer expired">
                <mat-icon>timer_off</mat-icon>
                Code expired — request a new one
              </span>
            }
          </div>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="resendCode()" [disabled]="resendCooldown() > 0 || loading()">
            @if (resendCooldown() > 0) { Resend in {{ resendCooldown() }}s }
            @else { Resend Code }
          </button>
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
    .auth-card { max-width: 420px; width: 100%; text-align: center; }
    mat-card-content { padding: var(--space-lg); }
    .timer-section { margin-top: 16px; }
    .timer { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: var(--mat-sys-on-surface-variant); }
    .timer mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .timer.expired { color: var(--mat-sys-error); }
  `],
})
export class VerifyCodeComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = input<string>('');
  loading = signal(false);
  resendCooldown = signal(0);
  codeExpiry = signal(600); // 10 minutes in seconds

  expiryDisplay = computed(() => {
    const s = this.codeExpiry();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  constructor() {
    this.startTimers();
  }

  onCodeComplete(code: string): void {
    this.loading.set(true);
    this.authService.verifyCode({ email: this.email(), code }).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.router.navigate(['/household']),
      error: err => {
        this.loading.set(false);
        const msg = err.status === 429
          ? 'Too many attempts. Please wait a few minutes.'
          : err.error?.message || 'Invalid or expired code';
        this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      },
    });
  }

  resendCode(): void {
    this.authService.resendCode({ email: this.email() }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.snackBar.open(res.message, 'OK', { duration: 3000, panelClass: 'success-snackbar' });
        this.codeExpiry.set(600);
        this.resendCooldown.set(60);
      },
      error: err => {
        const msg = err.status === 429
          ? 'Too many resend attempts. Please wait before trying again.'
          : 'Failed to resend code';
        this.snackBar.open(msg, 'Close', { duration: 5000, panelClass: 'error-snackbar' });
      },
    });
  }

  private startTimers(): void {
    interval(1000).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      const expiry = this.codeExpiry();
      if (expiry > 0) this.codeExpiry.set(expiry - 1);

      const cooldown = this.resendCooldown();
      if (cooldown > 0) this.resendCooldown.set(cooldown - 1);
    });
  }
}
