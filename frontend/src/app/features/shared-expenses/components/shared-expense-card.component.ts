import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Expense, ExpenseCategory, PaymentStatus, YearlyPaymentStrategy } from '../../../shared/models';
import { ExpensePayment } from '../../../shared/models/expense-payment.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';
import { PaymentBreakdownComponent } from '../../../shared/components/payment-breakdown.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shared-expense-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatTooltipModule, CurrencyEurPipe, PaymentBreakdownComponent],
  template: `
    <mat-card [class.paid]="isPaid()">
      <mat-card-header>
        <mat-card-title>{{ expense().name }}</mat-card-title>
        <mat-card-subtitle>
          <mat-chip-set>
            <mat-chip>{{ expense().category }}</mat-chip>
            <mat-chip>{{ expense().frequency }}</mat-chip>
            <mat-chip highlighted>Shared</mat-chip>
            @if (!expense().isFixed) {
              <mat-chip>Flexible</mat-chip>
            }
            @if (isSkipped()) {
              <mat-chip class="skipped-chip">Skipped</mat-chip>
            }
            @if (hasPendingApproval()) {
              <mat-chip class="pending-chip">Pending</mat-chip>
            }
            @if (isPaid()) {
              <mat-chip class="paid-chip">Paid</mat-chip>
            }
          </mat-chip-set>
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <span class="amount">{{ expense().amount | currencyEur }}</span>
        @if (isPaid() && !expense().isFixed && paymentStatus()?.paidAmount != null) {
          <app-payment-breakdown [paidAmount]="paymentStatus()!.paidAmount!" [remainingAmount]="paymentStatus()!.remainingAmount" />
        }
      </mat-card-content>
      <mat-card-actions>
        @if (isPaid()) {
          <button mat-icon-button (click)="undoPaid.emit(expense().id)" matTooltip="Mark as unpaid" [attr.aria-label]="'Mark ' + expense().name + ' as unpaid'">
            <mat-icon aria-hidden="true">undo</mat-icon>
          </button>
        } @else {
          <button mat-icon-button (click)="markPaid.emit(expense().id)" matTooltip="Mark as paid" [attr.aria-label]="'Mark ' + expense().name + ' as paid'">
            <mat-icon aria-hidden="true">check_circle</mat-icon>
          </button>
        }
        @if (isSkipped()) {
          <button mat-icon-button (click)="unskip.emit(expense().id)" [disabled]="hasPendingApproval()" matTooltip="Propose unskip for this month" [attr.aria-label]="'Propose unskip for ' + expense().name">
            <mat-icon aria-hidden="true">play_circle</mat-icon>
          </button>
        } @else {
          <button mat-icon-button (click)="skip.emit(expense().id)" [disabled]="hasPendingApproval()" matTooltip="Propose skip for this month" [attr.aria-label]="'Propose skip for ' + expense().name">
            <mat-icon aria-hidden="true">pause_circle</mat-icon>
          </button>
        }
        @if (hasTimeline()) {
          <button mat-icon-button (click)="viewTimeline.emit(expense().id)" matTooltip="Timeline" [attr.aria-label]="'View timeline for ' + expense().name">
            <mat-icon aria-hidden="true">timeline</mat-icon>
          </button>
        }
        <button mat-icon-button (click)="edit.emit(expense().id)" [disabled]="hasPendingApproval()" [attr.aria-label]="'Edit ' + expense().name"><mat-icon aria-hidden="true">edit</mat-icon></button>
        <button mat-icon-button (click)="remove.emit(expense().id)" [disabled]="hasPendingApproval()" [attr.aria-label]="'Delete ' + expense().name"><mat-icon aria-hidden="true">delete</mat-icon></button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    :host { display: flex; height: 100%; }
    mat-card { display: flex; flex-direction: column; width: 100%; }
    .amount { font-size: 20px; font-weight: 500; }
    mat-card-actions { display: flex; margin-top: auto; }
    .paid { opacity: 0.7; }
    .paid-chip { --mdc-chip-elevated-container-color: var(--chip-paid-bg); --mdc-chip-label-text-color: var(--chip-paid-text); }
    .pending-chip { --mdc-chip-elevated-container-color: #ff9800; }
    .skipped-chip { --mdc-chip-elevated-container-color: #ff9800; }
  `],
})
export class SharedExpenseCardComponent {
  readonly expense = input.required<Expense>();
  readonly hasPendingApproval = input(false);
  readonly isSkipped = input(false);
  readonly paymentStatus = input<ExpensePayment | null>(null);
  readonly edit = output<string>();
  readonly remove = output<string>();
  readonly markPaid = output<string>();
  readonly undoPaid = output<string>();
  readonly viewTimeline = output<string>();
  readonly skip = output<string>();
  readonly unskip = output<string>();

  readonly isPaid = computed(() => this.paymentStatus()?.status === PaymentStatus.PAID);
  readonly hasTimeline = computed(() => {
    const e = this.expense();
    return e.category === ExpenseCategory.RECURRING ||
      (e.category === ExpenseCategory.ONE_TIME && e.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS);
  });
}
