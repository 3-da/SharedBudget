import { Component, input, output, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Expense } from '../../../shared/models/expense.model';
import { ExpenseCategory } from '../../../shared/models/enums';
import { PaymentStatus } from '../../../shared/models/enums';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-expense-card',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatTooltipModule, CurrencyEurPipe],
  template: `
    <mat-card [class.paid]="isPaid()">
      <mat-card-header>
        <mat-card-title>{{ expense().name }}</mat-card-title>
        <mat-card-subtitle>
          <mat-chip-set>
            <mat-chip>{{ expense().category }}</mat-chip>
            <mat-chip>{{ expense().frequency }}</mat-chip>
            @if (isPaid()) {
              <mat-chip class="paid-chip">Paid</mat-chip>
            }
          </mat-chip-set>
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <span class="amount">{{ expense().amount | currencyEur }}</span>
      </mat-card-content>
      <mat-card-actions>
        @if (isPaid()) {
          <button mat-icon-button (click)="undoPaid.emit(expense().id)" matTooltip="Mark as unpaid">
            <mat-icon>undo</mat-icon>
          </button>
        } @else {
          <button mat-icon-button (click)="markPaid.emit(expense().id)" matTooltip="Mark as paid">
            <mat-icon>check_circle</mat-icon>
          </button>
        }
        @if (isRecurring()) {
          <button mat-icon-button (click)="viewTimeline.emit(expense().id)" matTooltip="Timeline">
            <mat-icon>timeline</mat-icon>
          </button>
        }
        <button mat-icon-button (click)="edit.emit(expense().id)"><mat-icon>edit</mat-icon></button>
        <button mat-icon-button (click)="remove.emit(expense().id)"><mat-icon>delete</mat-icon></button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .amount { font-size: 20px; font-weight: 500; }
    mat-card-actions { display: flex; }
    .paid { opacity: 0.7; }
    .paid-chip { --mdc-chip-elevated-container-color: #4caf50; }
  `],
})
export class ExpenseCardComponent {
  readonly expense = input.required<Expense>();
  readonly paymentStatus = input<PaymentStatus | null>(null);
  readonly edit = output<string>();
  readonly remove = output<string>();
  readonly markPaid = output<string>();
  readonly undoPaid = output<string>();
  readonly viewTimeline = output<string>();

  readonly isPaid = computed(() => this.paymentStatus() === PaymentStatus.PAID);
  readonly isRecurring = computed(() => this.expense().category === ExpenseCategory.RECURRING);
}
