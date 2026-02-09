import { Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettlementResponse } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-settlement-card',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header><mat-card-title>Settlement</mat-card-title></mat-card-header>
      <mat-card-content>
        @if (settlement(); as s) {
          <p>{{ s.message }}</p>
          @if (s.amount > 0) {
            <p class="amount">{{ s.amount | currencyEur }}</p>
          }
          @if (!s.isSettled && s.amount > 0) {
            <button mat-flat-button (click)="markPaid.emit()">
              <mat-icon>check_circle</mat-icon> Mark as Paid
            </button>
          }
          @if (s.isSettled) {
            <p class="settled"><mat-icon>verified</mat-icon> Settled</p>
          }
        } @else {
          <p>No settlement data available</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .amount { font-size: 24px; font-weight: 600; margin: 12px 0; }
    .settled { display: flex; align-items: center; gap: 8px; color: var(--color-positive); }
  `],
})
export class SettlementCardComponent {
  readonly settlement = input.required<SettlementResponse | null>();
  readonly markPaid = output<void>();
}
