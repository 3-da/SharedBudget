import { Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Approval } from '../../../shared/models/approval.model';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-approval-card',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, RelativeTimePipe],
  template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ approval().action }} Expense</mat-card-title>
        @if (approval().requestedBy) {
          <mat-card-subtitle>
            By {{ approval().requestedBy.firstName }} {{ approval().requestedBy.lastName }}
            &middot; {{ approval().createdAt | relativeTime }}
          </mat-card-subtitle>
        }
      </mat-card-header>
      <mat-card-content>
        <mat-chip-set>
          <mat-chip [highlighted]="approval().status === 'PENDING'">{{ approval().status }}</mat-chip>
          <mat-chip>{{ approval().action }}</mat-chip>
        </mat-chip-set>
        @if (approval().proposedData) {
          <div class="proposed-data">
            @if (approval().proposedData!['name']) {
              <div><strong>Name:</strong> {{ approval().proposedData!['name'] }}</div>
            }
            @if (approval().proposedData!['amount']) {
              <div><strong>Amount:</strong> {{ approval().proposedData!['amount'] }} EUR</div>
            }
          </div>
        }
        @if (approval().message) {
          <p class="message">{{ approval().message }}</p>
        }
      </mat-card-content>
      @if (approval().status === 'PENDING') {
        <mat-card-actions>
          @if (approval().requestedBy.id === currentUserId()) {
            <button mat-button color="warn" (click)="cancel.emit(approval().id)">
              <mat-icon>cancel</mat-icon> Cancel
            </button>
          } @else {
            <button mat-flat-button (click)="accept.emit(approval().id)">
              <mat-icon>check</mat-icon> Accept
            </button>
            <button mat-button color="warn" (click)="reject.emit(approval().id)">
              <mat-icon>close</mat-icon> Reject
            </button>
          }
        </mat-card-actions>
      }
    </mat-card>
  `,
  styles: [`
    .proposed-data { margin: 12px 0; }
    .message { font-style: italic; color: var(--mat-sys-on-surface-variant); }
    mat-card-actions { display: flex; gap: 8px; }
  `],
})
export class ApprovalCardComponent {
  readonly approval = input.required<Approval>();
  readonly currentUserId = input<string | null>(null);
  readonly accept = output<string>();
  readonly reject = output<string>();
  readonly cancel = output<string>();
}
