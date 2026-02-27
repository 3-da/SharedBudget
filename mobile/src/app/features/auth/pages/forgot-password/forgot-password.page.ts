import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonNote,
  IonSpinner,
  IonButtons,
  IonBackButton,
  IonText,
  IonProgressBar,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonInput, IonButton, IonNote, IonSpinner,
    IonButtons, IonBackButton, IonText, IonProgressBar,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/login" />
        </ion-buttons>
        <ion-title>Forgot Password</ion-title>
      </ion-toolbar>
    </ion-header>
    @if (loading()) { <ion-progress-bar type="indeterminate" /> }
    <ion-content class="ion-padding">
      <div class="auth-header">
        <h1>Reset Your Password</h1>
        <p>Enter your email to receive a reset link</p>
      </div>

      @if (sent()) {
        <div class="success-msg">
          <ion-text color="success">
            <p>If an account exists, we've sent a reset link to your email.</p>
          </ion-text>
          <ion-button fill="clear" routerLink="/auth/login">Back to Login</ion-button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <ion-item>
            <ion-input
              label="Email"
              labelPlacement="floating"
              type="email"
              formControlName="email" />
          </ion-item>
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <ion-note color="danger" class="ion-padding-start">Valid email is required</ion-note>
          }

          <ion-button expand="block" type="submit" [disabled]="loading()" class="ion-margin-top">
            @if (loading()) { <ion-spinner name="crescent" /> }
            @else { Send Reset Link }
          </ion-button>
        </form>
      }
    </ion-content>
  `,
  styles: [`
    .auth-header { text-align: center; margin: 24px 0 16px; }
    .auth-header h1 { font-size: 1.5rem; margin: 0; }
    .auth-header p { color: var(--ion-color-medium); margin: 4px 0 0; }
    .success-msg { text-align: center; padding: 32px 0; }
  `],
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  loading = signal(false);
  sent = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.authService.forgotPassword(this.form.getRawValue()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: () => { this.loading.set(false); this.sent.set(true); },
    });
  }
}
