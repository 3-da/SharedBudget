import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

export interface WithdrawDialogData {
  title: string;
  currentAmount: number;
  requiresApproval?: boolean;
}

@Component({
  selector: 'app-withdraw-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, ReactiveFormsModule, CurrencyEurPipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>Current savings: <strong>{{ data.currentAmount | currencyEur }}</strong></p>
      @if (data.requiresApproval) {
        <div class="approval-info">
          <mat-icon aria-hidden="true">info</mat-icon>
          <span>Withdrawals are deducted from the entire household pool and require another member's approval.</span>
        </div>
      }
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Withdraw amount (EUR)</mat-label>
        <input matInput type="number" [formControl]="amountControl" min="0.01" [max]="data.currentAmount">
        <mat-hint>Max: {{ data.currentAmount | currencyEur }}</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(null)">Cancel</button>
      <button mat-flat-button color="warn" [disabled]="amountControl.invalid" (click)="confirm()">
        {{ data.requiresApproval ? 'Request Withdrawal' : 'Withdraw' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 8px; }
    .approval-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      font-size: 0.875rem;
    }
    .approval-info mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
  `],
})
export class WithdrawDialogComponent {
  readonly dialogRef = inject(MatDialogRef<WithdrawDialogComponent, number | null>);
  readonly data: WithdrawDialogData = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  readonly amountControl = this.fb.nonNullable.control(0, [
    Validators.required,
    Validators.min(0.01),
    Validators.max(this.data.currentAmount),
  ]);

  confirm(): void {
    if (this.amountControl.valid) {
      this.dialogRef.close(this.amountControl.value);
    }
  }
}
