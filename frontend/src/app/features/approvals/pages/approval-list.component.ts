import { Component, inject, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { ApprovalStore } from '../stores/approval.store';
import { ApprovalCardComponent } from '../components/approval-card.component';
import { RejectDialogComponent } from '../components/reject-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';

@Component({
  selector: 'app-approval-list',
  standalone: true,
  imports: [MatTabsModule, ApprovalCardComponent, PageHeaderComponent, LoadingSpinnerComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Approvals" subtitle="Review shared expense proposals" />

    @if (store.loading()) {
      <app-loading-spinner />
    } @else {
      <mat-tab-group>
        <mat-tab>
          <ng-template mat-tab-label>Pending ({{ store.pendingCount() }})</ng-template>
          @if (store.pending().length === 0) {
            <app-empty-state icon="check_circle" title="All Clear" description="No pending approvals." />
          } @else {
            <div class="approval-grid">
              @for (a of store.pending(); track a.id) {
                <app-approval-card [approval]="a" (accept)="onAccept($event)" (reject)="onReject($event)" />
              }
            </div>
          }
        </mat-tab>
        <mat-tab label="History">
          @if (store.history().length === 0) {
            <app-empty-state icon="history" title="No History" description="No reviewed approvals yet." />
          } @else {
            <div class="approval-grid">
              @for (a of store.history(); track a.id) {
                <app-approval-card [approval]="a" (accept)="onAccept($event)" (reject)="onReject($event)" />
              }
            </div>
          }
        </mat-tab>
      </mat-tab-group>
    }
  `,
  styles: [`.approval-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 12px; padding: 16px 0; }`],
})
export class ApprovalListComponent implements OnInit {
  readonly store = inject(ApprovalStore);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    this.store.loadPending();
    this.store.loadHistory();
  }

  onAccept(id: string): void {
    this.store.accept(id);
  }

  onReject(id: string): void {
    this.dialog.open(RejectDialogComponent, { width: '400px' }).afterClosed().subscribe(message => {
      if (message) this.store.reject(id, message);
    });
  }
}
