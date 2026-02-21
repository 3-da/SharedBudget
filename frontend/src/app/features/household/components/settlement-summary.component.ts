import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SettlementResponse } from '../../../shared/models/dashboard.model';
import { CurrencyEurPipe } from '../../../shared/pipes/currency-eur.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settlement-summary',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, CurrencyEurPipe],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-icon matCardAvatar class="settlement-icon">handshake</mat-icon>
        <mat-card-title>Settlement</mat-card-title>
        <mat-card-subtitle>{{ monthLabel() }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <div class="settlement-info">
          <mat-icon>info_outline</mat-icon>
          <span>Calculates who owes whom based on shared expenses where one member paid more than their fair share.</span>
        </div>
        @if (settlement(); as s) {
          <p class="message">{{ s.message }}</p>
          @if (s.amount > 0) {
            <p class="amount">{{ s.amount | currencyEur }}</p>
          }
          @if (s.isSettled) {
            <div class="settled-badge">
              <mat-icon>verified</mat-icon>
              <span>Settled</span>
            </div>
          } @else if (s.amount > 0) {
            <button mat-flat-button (click)="markPaid.emit()">
              <mat-icon>check_circle</mat-icon> Mark as Paid
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
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
      border-radius: 50%;
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
      border-radius: 8px;
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      margin-bottom: 12px;
    }
    .settlement-info mat-icon { font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
    .message { margin: var(--space-sm) 0; }
    .amount { font: var(--mat-sys-headline-small); font-weight: 600; margin: var(--space-sm) 0; }
    .settled-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
      color: var(--color-positive);
      font-weight: 500;
    }
  `],
})
export class SettlementSummaryComponent {
  readonly settlement = input.required<SettlementResponse | null>();
  readonly monthLabel = input('');
  readonly markPaid = output<void>();
}
