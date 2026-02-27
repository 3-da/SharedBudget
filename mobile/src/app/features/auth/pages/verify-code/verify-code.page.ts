import { Component, inject, input, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonBackButton,
  IonIcon,
  IonNote,
  IonProgressBar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { timerOutline } from 'ionicons/icons';
import { switchMap, interval } from 'rxjs';
import { CodeInputComponent } from '../../components/code-input.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-verify-code',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonButtons, IonBackButton,
    IonIcon, IonNote, IonProgressBar,
    CodeInputComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/register" />
        </ion-buttons>
        <ion-title>Verify Email</ion-title>
      </ion-toolbar>
    </ion-header>
    @if (loading()) { <ion-progress-bar type="indeterminate" /> }
    <ion-content class="ion-padding">
      <div class="verify-header">
        <h2>Enter Verification Code</h2>
        <p>We sent a 6-digit code to {{ email() }}</p>
      </div>

      <app-code-input (codeComplete)="onCodeComplete($event)" />

      <div class="timer-section">
        @if (codeExpiry() > 0) {
          <ion-note>
            <ion-icon name="timer-outline" />
            Code expires in {{ expiryDisplay() }}
          </ion-note>
        } @else {
          <ion-note color="danger">
            Code expired — request a new one
          </ion-note>
        }
      </div>

      <div class="resend-section">
        <ion-button fill="clear" (click)="resendCode()" [disabled]="resendCooldown() > 0 || loading()">
          @if (resendCooldown() > 0) { Resend in {{ resendCooldown() }}s }
          @else { Resend Code }
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .verify-header { text-align: center; margin: 24px 0 32px; }
    .verify-header h2 { margin: 0 0 4px; }
    .verify-header p { color: var(--ion-color-medium); margin: 0; }
    .timer-section { text-align: center; margin-top: 24px; }
    .timer-section ion-icon { vertical-align: middle; margin-right: 4px; }
    .resend-section { text-align: center; margin-top: 8px; }
  `],
})
export class VerifyCodePage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = input<string>('');
  loading = signal(false);
  resendCooldown = signal(0);
  codeExpiry = signal(600);

  expiryDisplay = computed(() => {
    const s = this.codeExpiry();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  constructor() {
    addIcons({ timerOutline });
    this.startTimers();
  }

  onCodeComplete(code: string): void {
    this.loading.set(true);
    this.authService.verifyCode({ email: this.email(), code }).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.router.navigate(['/tabs/household']),
      error: err => {
        this.loading.set(false);
        const msg = err.status === 429
          ? 'Too many attempts. Please wait a few minutes.'
          : err.error?.message || 'Invalid or expired code';
        this.toast.showError(msg);
      },
    });
  }

  resendCode(): void {
    this.authService.resendCode({ email: this.email() }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.toast.showSuccess(res.message);
        this.codeExpiry.set(600);
        this.resendCooldown.set(60);
      },
      error: err => {
        const msg = err.status === 429
          ? 'Too many resend attempts. Please wait before trying again.'
          : 'Failed to resend code';
        this.toast.showError(msg);
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
