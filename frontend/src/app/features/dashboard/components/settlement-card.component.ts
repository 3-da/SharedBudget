import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettlementResponse } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
  selector: 'app-settlement-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatButtonModule, MatIconModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header><div class="summary-icon settlement"><span aria-hidden="true">✓</span></div><mat-card-title>Settlement</mat-card-title><mat-card-subtitle>Keep the balance fair</mat-card-subtitle></mat-card-header>
      <mat-card-content>
        @if (settlement(); as s) {
          <p>{{ s.message }}</p>
          @if (s.amount > 0) {
            <p class="amount">{{ s.amount | currencyEur }}</p>
          }
          @if (!s.isSettled && s.amount > 0) {
            <button mat-flat-button (click)="markPaid.emit()">
              <mat-icon aria-hidden="true">check_circle</mat-icon> Mark as Paid
            </button>
          }
          @if (s.isSettled) {
            <p class="settled"><mat-icon aria-hidden="true">verified</mat-icon> Settled</p>
          }
        } @else {
          <p>No settlement data available</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    mat-card { height: 100%; }
    mat-card-header { align-items: center; }
    .summary-icon { display: grid; width: 38px; height: 38px; margin-right: 12px; place-items: center; border-radius: 11px; font-size: 1rem; font-weight: 700; }
    .settlement { background: var(--color-warning-container); color: var(--color-warning); }
    mat-card-content > p:first-child { color: var(--color-ink-muted); }
    .amount { margin: 12px 0; color: var(--color-ink); font-size: 1.65rem; font-weight: 700; letter-spacing: -0.045em; }
    .settled { display: flex; align-items: center; gap: 8px; color: var(--color-positive); }
  `],
})
export class SettlementCardComponent {
  readonly settlement = input.required<SettlementResponse | null>();
  readonly markPaid = output<void>();
}
