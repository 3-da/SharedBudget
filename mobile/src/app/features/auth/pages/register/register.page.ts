import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
} from '@ionic/angular/standalone';
import { PasswordFieldComponent } from '../../components/password-field.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { passwordMatchValidator } from '../../../../shared/validators/password-match.validator';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonInput, IonButton, IonNote, IonSpinner,
    IonButtons, IonBackButton,
    PasswordFieldComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/auth/login" />
        </ion-buttons>
        <ion-title>Create Account</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="auth-header">
        <h1>Join SharedBudget</h1>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <ion-item>
          <ion-input
            label="First Name"
            labelPlacement="floating"
            formControlName="firstName"
            autocomplete="given-name" />
        </ion-item>
        @if (form.controls.firstName.touched && form.controls.firstName.invalid) {
          <ion-note color="danger" class="ion-padding-start">First name is required</ion-note>
        }

        <ion-item>
          <ion-input
            label="Last Name"
            labelPlacement="floating"
            formControlName="lastName"
            autocomplete="family-name" />
        </ion-item>
        @if (form.controls.lastName.touched && form.controls.lastName.invalid) {
          <ion-note color="danger" class="ion-padding-start">Last name is required</ion-note>
        }

        <ion-item>
          <ion-input
            label="Email"
            labelPlacement="floating"
            type="email"
            formControlName="email"
            autocomplete="email" />
        </ion-item>
        @if (form.controls.email.touched && form.controls.email.invalid) {
          <ion-note color="danger" class="ion-padding-start">
            @if (form.controls.email.hasError('required')) { Email is required }
            @else if (form.controls.email.hasError('email')) { Invalid email }
          </ion-note>
        }

        <app-password-field [control]="form.controls.password" />
        <app-password-field label="Confirm Password" [control]="form.controls.confirmPassword" />

        @if (form.hasError('passwordMismatch')) {
          <ion-note color="danger" class="ion-padding-start">Passwords do not match</ion-note>
        }

        <ion-button expand="block" type="submit" [disabled]="loading()" class="ion-margin-top">
          @if (loading()) { <ion-spinner name="crescent" /> }
          @else { Create Account }
        </ion-button>
      </form>

      <div class="auth-links">
        <ion-button fill="clear" routerLink="/auth/login" size="small">
          Already have an account?
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .auth-header { text-align: center; margin: 16px 0; }
    .auth-header h1 { font-size: 1.5rem; margin: 0; }
    .auth-links { display: flex; justify-content: center; margin-top: 16px; }
  `],
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
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
        this.toast.showSuccess('Verification code sent!');
        this.router.navigate(['/auth/verify-code'], { queryParams: { email: dto.email } });
      },
      error: err => {
        this.loading.set(false);
        this.toast.showError(err.error?.message || 'Registration failed');
      },
    });
  }
}
