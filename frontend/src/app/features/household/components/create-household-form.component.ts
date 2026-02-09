import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { HouseholdStore } from '../stores/household.store';

@Component({
  selector: 'app-create-household-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Household Name</mat-label>
        <input matInput formControlName="name" placeholder="e.g., The Smiths">
        <mat-error>Name is required (max 50 chars)</mat-error>
      </mat-form-field>
      <button mat-flat-button type="submit" class="full-width" [disabled]="store.loading()">
        Create Household
      </button>
    </form>
  `,
  styles: [`.full-width { width: 100%; } form { display: flex; flex-direction: column; gap: 8px; }`],
})
export class CreateHouseholdFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly store = inject(HouseholdStore);
  form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(50)]] });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.store.createHousehold(this.form.getRawValue().name);
  }
}
