import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { filter, switchMap } from 'rxjs';
import { HouseholdStore } from '../stores/household.store';
import { MemberListComponent } from './member-list.component';
import { InviteDialogComponent } from './invite-dialog.component';
import { InvitationService } from '../services/invitation.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-household-management',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule, MatDividerModule, MatExpansionModule,
    MemberListComponent,
  ],
  template: `
    <mat-expansion-panel>
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>settings</mat-icon>
          Household Management
        </mat-panel-title>
        <mat-panel-description>
          {{ store.members().length }} / {{ store.household()!.maxMembers }} members
        </mat-panel-description>
      </mat-expansion-panel-header>

      @if (store.isOwner()) {
        <div class="invite-code-section">
          <span class="code-label">Invite Code:</span>
          <code class="invite-code">{{ store.household()!.inviteCode }}</code>
          <button mat-icon-button (click)="copyCode()" aria-label="Copy invite code"><mat-icon aria-hidden="true">content_copy</mat-icon></button>
          <button mat-icon-button (click)="store.regenerateCode()" aria-label="Regenerate invite code"><mat-icon aria-hidden="true">refresh</mat-icon></button>
        </div>
        <mat-divider />
      }

      <app-member-list
        [members]="store.members()"
        [isOwner]="store.isOwner()"
        (remove)="confirmRemove($event)"
        (transfer)="confirmTransfer($event)" />

      <div class="actions">
        @if (store.isOwner()) {
          <button mat-flat-button (click)="openInviteDialog()">
            <mat-icon>person_add</mat-icon> Invite
          </button>
        }
        <button mat-button color="warn" (click)="confirmLeave()">
          <mat-icon>exit_to_app</mat-icon> Leave Household
        </button>
      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .invite-code-section { display: flex; align-items: center; gap: var(--space-sm); margin: var(--space-md) 0; flex-wrap: wrap; }
    .invite-code {
      font-size: 18px;
      letter-spacing: 2px;
      padding: 4px 12px;
      background: var(--mat-sys-surface-variant);
      border-radius: 4px;
    }
    .actions { display: flex; gap: var(--space-sm); margin-top: var(--space-md); flex-wrap: wrap; }
    mat-panel-title mat-icon { margin-right: var(--space-sm); flex-shrink: 0; }
  `],
})
export class HouseholdManagementComponent {
  readonly store = inject(HouseholdStore);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly invitationService = inject(InvitationService);
  private readonly destroyRef = inject(DestroyRef);

  copyCode(): void {
    this.clipboard.copy(this.store.household()!.inviteCode);
    this.snackBar.open('Code copied!', '', { duration: 2000 });
  }

  openInviteDialog(): void {
    this.dialog.open(InviteDialogComponent, { width: '400px' }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      filter((email): email is string => !!email),
      switchMap(email => this.invitationService.invite({ email })),
    ).subscribe({
      next: () => this.snackBar.open('Invitation sent', '', { duration: 3000 }),
      error: err => this.snackBar.open(err.error?.message || 'Failed to invite', '', { duration: 3000 }),
    });
  }

  confirmRemove(userId: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Remove Member', message: 'Are you sure you want to remove this member?', confirmText: 'Remove', color: 'warn' } as ConfirmDialogData,
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(Boolean),
    ).subscribe(() => this.store.removeMember(userId));
  }

  confirmTransfer(userId: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Transfer Ownership', message: 'This will make the selected member the new owner. Continue?', confirmText: 'Transfer', color: 'warn' } as ConfirmDialogData,
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(Boolean),
    ).subscribe(() => this.store.transferOwnership(userId));
  }

  confirmLeave(): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Leave Household', message: 'Are you sure you want to leave this household?', confirmText: 'Leave', color: 'warn' } as ConfirmDialogData,
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(Boolean),
    ).subscribe(() => this.store.leave());
  }
}
