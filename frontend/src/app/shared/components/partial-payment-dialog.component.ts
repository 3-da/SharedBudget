import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface PartialPaymentDialogData {
  expenseName: string;
  plannedAmount: number;
}

@Component({
  selector: 'app-partial-payment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, DecimalPipe],
  template: `
    <h2 mat-dialog-title>How much did you actually pay?</h2>
    <mat-dialog-content>
      <p>{{ data.expenseName }} — planned: {{ data.plannedAmount | number:'1.2-2' }} EUR</p>
      <form [formGroup]="form" (ngSubmit)="onConfirm()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Actual amount paid (EUR)</mat-label>
          <input matInput type="number" formControlName="paidAmount" min="0.01" step="0.01">
          <mat-error>Enter a valid amount greater than 0</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(null)">Cancel</button>
      <button mat-flat-button color="primary" (click)="onConfirm()" [disabled]="form.invalid">
        Confirm Payment
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.full-width { width: 100%; }`],
})
export class PartialPaymentDialogComponent {
  readonly dialogRef = inject(MatDialogRef<PartialPaymentDialogComponent>);
  readonly data: PartialPaymentDialogData = inject(MAT_DIALOG_DATA);

  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    paidAmount: [this.data.plannedAmount, [Validators.required, Validators.min(0.01)]],
  });

  onConfirm(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.controls.paidAmount.value);
  }
}
