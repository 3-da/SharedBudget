import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { HouseholdStore } from '../stores/household.store';

@Component({
  selector: 'app-join-by-code-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Invite Code</mat-label>
        <input matInput formControlName="inviteCode" placeholder="8-character code" maxlength="8">
        <mat-error>Valid 8-character code is required</mat-error>
      </mat-form-field>
      <button mat-flat-button type="submit" class="full-width" [disabled]="store.loading()">
        Join Household
      </button>
    </form>
  `,
  styles: [`.full-width { width: 100%; } form { display: flex; flex-direction: column; gap: 8px; }`],
})
export class JoinByCodeFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly store = inject(HouseholdStore);
  form = this.fb.nonNullable.group({
    inviteCode: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(8)]],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.store.joinByCode(this.form.getRawValue().inviteCode);
  }
}
