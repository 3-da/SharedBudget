import { Component, DestroyRef, inject, input, signal, OnDestroy } from '@angular/core';
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
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { moonOutline } from 'ionicons/icons';
import { switchMap } from 'rxjs';
import { PasswordFieldComponent } from '../../components/password-field.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonItem, IonInput, IonButton, IonNote, IonSpinner, IonIcon,
    PasswordFieldComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Sign In</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="auth-header">
        <h1>Welcome Back</h1>
        <p>Sign in to SharedBudget</p>
      </div>

      @if (showWakeUpMessage()) {
        <div class="wake-up-banner">
          <ion-icon name="moon-outline" />
          <div>
            <strong>Server is waking up...</strong>
            <p>The free-tier server was sleeping. First login can take up to 2 minutes.</p>
          </div>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
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

        <ion-button expand="block" type="submit" [disabled]="loading()" class="ion-margin-top">
          @if (loading()) { <ion-spinner name="crescent" /> }
          @else { Sign In }
        </ion-button>
      </form>

      <div class="auth-links">
        <ion-button fill="clear" routerLink="/auth/register" size="small">
          Create an account
        </ion-button>
        <ion-button fill="clear" routerLink="/auth/forgot-password" size="small">
          Forgot password?
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .auth-header { text-align: center; margin: 24px 0 16px; }
    .auth-header h1 { font-size: 1.5rem; margin: 0; }
    .auth-header p { color: var(--ion-color-medium); margin: 4px 0 0; }
    .auth-links { display: flex; flex-direction: column; align-items: center; margin-top: 16px; }
    .wake-up-banner {
      display: flex; align-items: flex-start; gap: 12px;
      background: var(--ion-color-warning-tint);
      border-radius: 8px; padding: 12px 16px;
      margin-bottom: 16px;
    }
    .wake-up-banner ion-icon { font-size: 24px; margin-top: 2px; }
    .wake-up-banner p { margin: 2px 0 0; font-size: 0.85rem; }
  `],
})
export class LoginPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  loading = signal(false);
  showWakeUpMessage = signal(false);
  readonly returnUrl = input<string>('');

  private wakeUpTimer: ReturnType<typeof setTimeout> | null = null;

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ moonOutline });
  }

  ngOnDestroy(): void {
    if (this.wakeUpTimer) clearTimeout(this.wakeUpTimer);
  }

  private sanitizeReturnUrl(url: string): string {
    if (!url || url.startsWith('//') || url.includes('@') || /^https?:/i.test(url)) {
      return '/tabs/household';
    }
    return url.startsWith('/') ? url : '/tabs/household';
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.showWakeUpMessage.set(false);

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
        this.toast.showError(err.error?.message || 'Login failed');
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
