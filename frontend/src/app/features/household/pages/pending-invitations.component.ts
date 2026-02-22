import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
              <mat-icon matCardAvatar aria-hidden="true">mail</mat-icon>
              <mat-card-title>{{ inv.householdName }}</mat-card-title>
              <mat-card-subtitle>Invited by {{ inv.senderFirstName }} {{ inv.senderLastName }} · {{ inv.createdAt | relativeTime }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button mat-flat-button (click)="respond(inv.id, true)">
                <mat-icon aria-hidden="true">check</mat-icon>
                <span>Accept</span>
              </button>
              <button mat-button (click)="respond(inv.id, false)">
                <mat-icon aria-hidden="true">close</mat-icon>
                <span>Decline</span>
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    }
  `,
  styles: [`
    .invitations-list { max-width: 640px; margin: 16px auto; display: flex; flex-direction: column; gap: 12px; }
    mat-card-actions { display: flex; gap: 8px; }
    mat-icon[matCardAvatar] {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      border-radius: 50%; width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center; font-size: 24px;
    }
  `],
})
export class PendingInvitationsComponent implements OnInit {
  readonly store = inject(HouseholdStore);
  private readonly invitationService = inject(InvitationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.store.loadInvitations();
  }

  respond(id: string, accept: boolean): void {
    this.invitationService.respond(id, { accept }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.snackBar.open(res.message, '', { duration: 3000 });
        this.store.loadInvitations();
        if (accept) this.store.loadHousehold();
      },
      error: err => this.snackBar.open(err.error?.message || 'Failed', '', { duration: 3000 }),
    });
  }
}
