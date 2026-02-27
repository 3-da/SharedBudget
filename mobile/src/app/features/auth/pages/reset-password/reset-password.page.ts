import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonNote,
  IonProgressBar,
} from '@ionic/angular/standalone';
import { PasswordFieldComponent } from '../../components/password-field.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { passwordMatchValidator } from '../../../../shared/validators/password-match.validator';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonSpinner, IonButtons, IonBackButton, IonNote, IonProgressBar,
    PasswordFieldComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/login" />
        </ion-buttons>
        <ion-title>Reset Password</ion-title>
      </ion-toolbar>
    </ion-header>
    @if (loading()) { <ion-progress-bar type="indeterminate" /> }
    <ion-content class="ion-padding">
      <div class="auth-header">
        <h1>New Password</h1>
        <p>Enter your new password below</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <app-password-field label="New Password" [control]="form.controls.password" />
        <app-password-field label="Confirm Password" [control]="form.controls.confirmPassword" />

        @if (form.hasError('passwordMismatch')) {
          <ion-note color="danger" class="ion-padding-start">Passwords do not match</ion-note>
        }

        <ion-button expand="block" type="submit" [disabled]="loading()" class="ion-margin-top">
          @if (loading()) { <ion-spinner name="crescent" /> }
          @else { Reset Password }
        </ion-button>
      </form>

      <div class="auth-links">
        <ion-button fill="clear" routerLink="/auth/login" size="small">
          Back to Login
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .auth-header { text-align: center; margin: 24px 0 16px; }
    .auth-header h1 { font-size: 1.5rem; margin: 0; }
    .auth-header p { color: var(--ion-color-medium); margin: 4px 0 0; }
    .auth-links { display: flex; justify-content: center; margin-top: 16px; }
  `],
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
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
        this.toast.showSuccess('Password reset successful. Please log in.');
        this.router.navigate(['/auth/login']);
      },
      error: err => {
        this.loading.set(false);
        this.toast.showError(err.error?.message || 'Reset failed. The link may have expired.');
      },
    });
  }
}
