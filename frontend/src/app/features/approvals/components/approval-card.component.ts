import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Approval } from '../../../shared/models/approval.model';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-approval-card',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, RelativeTimePipe],
  template: `
    <mat-card>
      <mat-card-header>
        <div class="approval-icon" aria-hidden="true"><mat-icon>how_to_reg</mat-icon></div>
        <span class="card-kicker">Household decision</span>
        <mat-card-title>{{ approvalActionTitle() }}</mat-card-title>
        @if (approval().requestedBy) {
          <mat-card-subtitle>
            By {{ approval().requestedBy.firstName }} {{ approval().requestedBy.lastName }}
            &middot; {{ approval().createdAt | relativeTime }}
          </mat-card-subtitle>
        }
      </mat-card-header>
      <mat-card-content>
        <mat-chip-set>
          @switch (approval().status) {
            @case ('CANCELLED') {
              <mat-chip class="status-cancelled">CANCELLED</mat-chip>
            }
            @case ('ACCEPTED') {
              <mat-chip class="status-accepted">ACCEPTED</mat-chip>
            }
            @case ('REJECTED') {
              <mat-chip class="status-rejected">REJECTED</mat-chip>
            }
            @default {
              <mat-chip [highlighted]="approval().status === 'PENDING'">
                {{ approval().status }}
              </mat-chip>
            }
          }
          <mat-chip>{{ approvalActionLabel() }}</mat-chip>
        </mat-chip-set>
        @if (approval().proposedData) {
          <div class="proposed-data">
            @if (approval().proposedData!['name']) {
              <div><span>Name</span><strong>{{ approval().proposedData!['name'] }}</strong></div>
            }
            @if (approval().proposedData!['amount']) {
              <div><span>Amount</span><strong>{{ approval().proposedData!['amount'] }} EUR</strong></div>
            }
          </div>
        }
        @if (approval().message && approval().status !== 'CANCELLED') {
          <p class="message">{{ approval().message }}</p>
        }
      </mat-card-content>
      @if (approval().status === 'PENDING') {
        <mat-card-actions>
          @if (approval().requestedBy.id === currentUserId()) {
            <button mat-button color="warn" (click)="cancel.emit(approval().id)">
              <mat-icon aria-hidden="true">cancel</mat-icon> Cancel
            </button>
          } @else {
            <button mat-flat-button (click)="accept.emit(approval().id)">
              <mat-icon aria-hidden="true">check</mat-icon> Accept
            </button>
            <button mat-button color="warn" (click)="reject.emit(approval().id)">
              <mat-icon aria-hidden="true">close</mat-icon> Reject
            </button>
          }
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    mat-card { position: relative; display: grid; min-height: 100%; grid-template-rows: auto 1fr auto; overflow: hidden; }
    mat-card-header { min-height: 116px; flex-direction: column; padding-right: 70px; box-sizing: border-box; }
    .approval-icon { position: absolute; top: 18px; right: 18px; display: grid; width: 38px; height: 38px; place-items: center; border-radius: 11px; background: var(--color-brand-soft); color: var(--color-brand-strong); }
    .approval-icon mat-icon { width: 20px; height: 20px; font-size: 20px; }
    .card-kicker { margin-bottom: 7px; color: var(--color-brand); font-size: 0.64rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    mat-card-subtitle { margin-top: 6px; }
    mat-card-content { display: flex; flex-direction: column; padding-bottom: 18px !important; }
    .proposed-data { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 16px 0 0; word-break: break-word; }
    .proposed-data div { display: flex; flex-direction: column; gap: 3px; padding: 11px 12px; border-radius: 10px; background: var(--color-panel-subtle); }
    .proposed-data span { color: var(--color-ink-muted); font-size: 0.66rem; }
    .proposed-data strong { color: var(--color-ink); font-size: 0.82rem; }
    .message { padding: 11px 12px; border-left: 3px solid var(--color-border-strong); color: var(--color-ink-muted); font-size: 0.78rem; font-style: italic; word-break: break-word; }
    mat-card-actions { display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid var(--color-border); }
    mat-chip-set { flex-wrap: wrap; }
    .status-accepted { --mdc-chip-elevated-container-color: var(--chip-accepted-bg); --mdc-chip-label-text-color: var(--chip-accepted-text); }
    .status-rejected { --mdc-chip-elevated-container-color: var(--chip-rejected-bg); --mdc-chip-label-text-color: var(--chip-rejected-text); }
    .status-cancelled { --mdc-chip-elevated-container-color: var(--chip-cancelled-bg); --mdc-chip-label-text-color: var(--chip-cancelled-text); }
    @media (max-width: 420px) { .proposed-data { grid-template-columns: 1fr; } }
  `],
})
export class ApprovalCardComponent {
  readonly approval = input.required<Approval>();
  readonly currentUserId = input<string | null>(null);
  readonly accept = output<string>();
  readonly reject = output<string>();
  readonly cancel = output<string>();

  readonly approvalActionTitle = computed(() => {
    const approvalActionTitles: Record<string, string> = {
      CREATE: 'New shared expense',
      UPDATE: 'Expense update',
      DELETE: 'Remove shared expense',
      WITHDRAW_SAVINGS: 'Savings withdrawal',
      SKIP_MONTH: 'Skip expense this month',
      UNSKIP_MONTH: 'Restore expense this month',
    };

    return approvalActionTitles[this.approval().action] ?? 'Household decision';
  });

  readonly approvalActionLabel = computed(() => {
    const approvalActionLabels: Record<string, string> = {
      CREATE: 'New expense',
      UPDATE: 'Update',
      DELETE: 'Removal',
      WITHDRAW_SAVINGS: 'Withdrawal',
      SKIP_MONTH: 'Skip month',
      UNSKIP_MONTH: 'Restore month',
    };

    return approvalActionLabels[this.approval().action] ?? 'Decision';
  });
}
