import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettlementResponse } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settlement-summary',
  imports: [MatCardModule, MatButtonModule, MatIconModule, CurrencyEurPipe],
  template: `
    <mat-card class="settlement-card">
      <mat-card-header>
        <mat-icon matCardAvatar class="settlement-icon" aria-hidden="true">handshake</mat-icon>
        <mat-card-title>Settlement</mat-card-title>
        <mat-card-subtitle>{{ monthLabel() }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="settlement-info">
          <mat-icon aria-hidden="true">info_outline</mat-icon>
          <span>Calculates who owes whom based on shared expenses where one member paid more than their fair share.</span>
        </div>
        @if (settlement(); as s) {
          <p class="message">{{ s.message }}</p>
          @if (s.amount > 0) {
            <p class="amount">{{ s.amount | currencyEur }}</p>
          }
          @if (s.isSettled) {
            <div class="settled-badge">
              <mat-icon aria-hidden="true">verified</mat-icon>
              <span>Settled</span>
            </div>
          } @else if (s.amount > 0) {
            <button mat-flat-button (click)="markPaid.emit()">
              <mat-icon aria-hidden="true">check_circle</mat-icon> Mark as Paid
            </button>
          }
        } @else {
          <p class="message">No settlement data</p>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .settlement-icon {
      background: var(--color-positive-container);
      color: var(--color-positive);
      border-radius: 12px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .settlement-info {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 12px;
      background: var(--color-panel-subtle);
      color: var(--color-ink-muted);
      font: var(--mat-sys-body-small);
      margin-bottom: 12px;
    }
    .settlement-info mat-icon { font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
    .settlement-card { border-color: color-mix(in srgb, var(--color-positive) 22%, var(--color-border)); }
    .message { margin: 14px 0 5px; color: var(--color-ink-muted); }
    .amount { margin: var(--space-sm) 0 16px; color: var(--color-ink); font-size: 1.8rem; font-weight: 700; letter-spacing: -0.045em; }
    .settled-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
      color: var(--color-positive);
      font-weight: 650;
    }
  `],
})
export class SettlementSummaryComponent {
  readonly settlement = input.required<SettlementResponse | null>();
  readonly monthLabel = input('');
  readonly markPaid = output<void>();
}
