import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

export interface RecurringOverrideDialogData {
  expenseName: string;
  currentAmount: number;
  month: number;
  year: number;
}

export interface RecurringOverrideDialogResult {
  amount: number;
  skipped: boolean;
  scope: 'single' | 'all_upcoming';
}

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recurring-override-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatRadioModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Override: {{ data.expenseName }}</h2>
    <mat-dialog-content>
      <p>Customize amount for {{ monthLabel }} {{ data.year }}</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Amount (EUR)</mat-label>
          <input matInput type="number" formControlName="amount" min="0">
        </mat-form-field>
        <mat-checkbox formControlName="skipped">Skip this month</mat-checkbox>
        <mat-radio-group formControlName="scope" class="scope-group">
          <mat-radio-button value="single">This month only</mat-radio-button>
          <mat-radio-button value="all_upcoming">All upcoming months</mat-radio-button>
        </mat-radio-group>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [disabled]="form.invalid" (click)="onSave()">Save Override</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; }
    form { display: flex; flex-direction: column; gap: 8px; }
    .scope-group { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  `],
})
export class RecurringOverrideDialogComponent {
  readonly data = inject<RecurringOverrideDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<RecurringOverrideDialogComponent>);
  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    amount: [this.data.currentAmount, [Validators.required, Validators.min(0)]],
    skipped: [false],
    scope: ['single' as 'single' | 'all_upcoming'],
  });

  readonly monthLabel = new Date(this.data.year, this.data.month - 1).toLocaleDateString('en-US', { month: 'long' });

  onSave(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue() as RecurringOverrideDialogResult);
  }
}
