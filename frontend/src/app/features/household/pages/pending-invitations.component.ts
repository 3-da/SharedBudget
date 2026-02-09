import { Component, inject, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HouseholdStore } from '../stores/household.store';
import { InvitationService } from '../services/invitation.service';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';

@Component({
  selector: 'app-pending-invitations',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, RelativeTimePipe, EmptyStateComponent, LoadingSpinnerComponent],
  template: `
    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.invitations().length === 0) {
      <app-empty-state icon="mail" title="No Pending Invitations" description="You have no household invitations." />
    } @else {
      <div class="invitations-list">
        @for (inv of store.invitations(); track inv.id) {
          <mat-card>
            <mat-card-header>
              <mat-card-title>{{ inv.householdName }}</mat-card-title>
              <mat-card-subtitle>From {{ inv.sender.firstName }} {{ inv.sender.lastName }} &middot; {{ inv.createdAt | relativeTime }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button mat-flat-button (click)="respond(inv.id, true)"><mat-icon>check</mat-icon> Accept</button>
              <button mat-button (click)="respond(inv.id, false)"><mat-icon>close</mat-icon> Decline</button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .invitations-list { max-width: 640px; margin: 16px auto; display: flex; flex-direction: column; gap: 12px; }
    mat-card-actions { display: flex; gap: 8px; }
  `],
})
export class PendingInvitationsComponent implements OnInit {
  readonly store = inject(HouseholdStore);
  private readonly invitationService = inject(InvitationService);
  private readonly snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.store.loadInvitations();
  }

  respond(id: string, accept: boolean): void {
    this.invitationService.respond(id, { accept }).subscribe({
      next: res => {
        this.snackBar.open(res.message, '', { duration: 3000 });
        this.store.loadInvitations();
        if (accept) this.store.loadHousehold();
      },
      error: err => this.snackBar.open(err.error?.message || 'Failed', '', { duration: 3000 }),
    });
  }
}
