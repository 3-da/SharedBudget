import { Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ChangePasswordRequest } from '../../../shared/models/user.model';

@Component({
  selector: 'app-change-password-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Current Password</mat-label>
        <input matInput type="password" formControlName="currentPassword">
        <mat-error>Current password is required</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>New Password</mat-label>
        <input matInput type="password" formControlName="newPassword">
        <mat-error>Min 8 characters required</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Confirm New Password</mat-label>
        <input matInput type="password" formControlName="confirmPassword">
        @if (form.hasError('passwordMismatch')) {
          <mat-error>Passwords do not match</mat-error>
        }
      </mat-form-field>
      <button mat-flat-button type="submit" [disabled]="loading()">Change Password</button>
    </form>
  `,
  styles: [`.full-width { width: 100%; } form { display: flex; flex-direction: column; gap: 8px; }`],
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
