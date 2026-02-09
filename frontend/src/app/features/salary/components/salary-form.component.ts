import { Component, inject, input, output, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { SalaryResponse } from '../../../shared/models/salary.model';

@Component({
  selector: 'app-salary-form',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Default Salary (EUR)</mat-label>
        <input matInput type="number" formControlName="defaultAmount" min="0">
        <mat-error>Valid amount is required</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Current Salary (EUR)</mat-label>
        <input matInput type="number" formControlName="currentAmount" min="0">
        <mat-error>Valid amount is required</mat-error>
      </mat-form-field>
      <button mat-flat-button type="submit" class="full-width" [disabled]="loading()">Save Salary</button>
    </form>
  `,
  styles: [`.full-width { width: 100%; } form { display: flex; flex-direction: column; gap: 8px; }`],
})
export class SalaryFormComponent {
  readonly salary = input<SalaryResponse | null>(null);
  readonly loading = input(false);
  readonly save = output<{ defaultAmount: number; currentAmount: number }>();

  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    defaultAmount: [0, [Validators.required, Validators.min(0)]],
    currentAmount: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      const s = this.salary();
      if (s) this.form.patchValue({ defaultAmount: s.defaultAmount, currentAmount: s.currentAmount });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.save.emit(this.form.getRawValue());
  }
}
