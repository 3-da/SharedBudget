import { ChangeDetectionStrategy, Component, inject, input, output, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { User, UpdateProfileRequest } from '../../../shared/models/user.model';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>First Name</mat-label>
        <input matInput formControlName="firstName">
        <mat-error>First name is required</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Last Name</mat-label>
        <input matInput formControlName="lastName">
        <mat-error>Last name is required</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email</mat-label>
        <input matInput [value]="user()?.email ?? ''" disabled>
      </mat-form-field>
      <button mat-flat-button type="submit" [disabled]="loading()">Update Profile</button>
    </form>
  `,
  styles: [`.full-width { width: 100%; } form { display: flex; flex-direction: column; gap: 8px; }`],
})
export class ProfileFormComponent {
  readonly user = input<User | null>(null);
  readonly loading = input(false);
  readonly save = output<UpdateProfileRequest>();

  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (u) this.form.patchValue({ firstName: u.firstName, lastName: u.lastName });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.save.emit(this.form.getRawValue());
  }
}
