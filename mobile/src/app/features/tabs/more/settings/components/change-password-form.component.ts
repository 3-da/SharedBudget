import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { IonItem, IonInput, IonButton, IonNote } from '@ionic/angular/standalone';
import { ChangePasswordRequest } from '../../../../../shared/models/user.model';

@Component({
  selector: 'app-change-password-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonItem, IonInput, IonButton, IonNote],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <ion-item>
        <ion-input label="Current Password" labelPlacement="floating" type="password" formControlName="currentPassword" />
      </ion-item>
      <ion-item>
        <ion-input label="New Password" labelPlacement="floating" type="password" formControlName="newPassword" />
      </ion-item>
      @if (form.controls.newPassword.touched && form.controls.newPassword.hasError('minlength')) {
        <ion-note color="danger" class="ion-padding-start">Min 8 characters</ion-note>
      }
      <ion-item>
        <ion-input label="Confirm Password" labelPlacement="floating" type="password" formControlName="confirmPassword" />
      </ion-item>
      @if (form.hasError('passwordMismatch') && form.controls.confirmPassword.touched) {
        <ion-note color="danger" class="ion-padding-start">Passwords do not match</ion-note>
      }
      <ion-button expand="block" type="submit" [disabled]="loading() || form.invalid" class="ion-margin-top">
        Change Password
      </ion-button>
    </form>
  `,
})
export class ChangePasswordFormComponent {
  readonly loading = input(false);
  readonly save = output<ChangePasswordRequest>();
  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: [this.passwordMatchValidator] });

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const pw = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pw === confirm ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.save.emit({ currentPassword, newPassword });
    this.form.reset();
  }
}
