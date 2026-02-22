import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { switchMap, filter } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiService } from '../../../core/api/api.service';
import { HouseholdStore } from '../../household/stores/household.store';
import { ProfileFormComponent } from '../components/profile-form.component';
import { ChangePasswordFormComponent } from '../components/change-password-form.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog.component';
import { UpdateProfileRequest, ChangePasswordRequest, PendingDeleteRequest, RequestAccountDeletionRequest, RespondToDeleteRequest } from '../../../shared/models/user.model';
import { MessageResponse } from '../../../shared/models/auth.model';
import { HouseholdRole } from '../../../shared/models/enums';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatExpansionModule, MatButtonModule, MatSelectModule, MatFormFieldModule, MatIconModule,
    FormsModule,
    ProfileFormComponent, ChangePasswordFormComponent, PageHeaderComponent,
  ],
  template: `
    <app-page-header title="Settings" subtitle="Manage your account" />
    <div class="settings-container">
      <mat-accordion>
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>Profile</mat-panel-title>
          </mat-expansion-panel-header>
          <app-profile-form
            [user]="authService.currentUser()"
            [loading]="loading()"
            (save)="onUpdateProfile($event)" />
        </mat-expansion-panel>
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Change Password</mat-panel-title>
          </mat-expansion-panel-header>
          <app-change-password-form
            [loading]="loading()"
            (save)="onChangePassword($event)" />
        </mat-expansion-panel>

        <!-- Pending delete account request (target member sees this) -->
        @if (pendingIncomingRequest()) {
          <mat-expansion-panel expanded class="warn-panel">
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon aria-hidden="true">warning</mat-icon>
                Account Deletion Request
              </mat-panel-title>
            </mat-expansion-panel-header>
            <div class="delete-request-info">
              <p>
                <strong>{{ pendingIncomingRequest()!.ownerFirstName }} {{ pendingIncomingRequest()!.ownerLastName }}</strong>
                wants to delete their account from <strong>{{ pendingIncomingRequest()!.householdName }}</strong>.
              </p>
              <p class="secondary-text">
                If you <strong>accept</strong>, you will become the new household owner and their account will be deleted.<br>
                If you <strong>reject</strong>, the entire household and all its data will be permanently deleted.
              </p>
              <div class="action-row">
                <button mat-flat-button color="primary" [disabled]="loading()" (click)="respondToDeleteRequest(true)">
                  Accept (Become Owner)
                </button>
                <button mat-stroked-button color="warn" [disabled]="loading()" (click)="respondToDeleteRequest(false)">
                  Reject (Delete Household)
                </button>
              </div>
            </div>
          </mat-expansion-panel>
        }

        <!-- Danger Zone -->
        <mat-expansion-panel class="danger-panel">
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon aria-hidden="true">dangerous</mat-icon>
              Danger Zone
            </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="danger-zone">
            <!-- Owner with multiple members: request flow -->
            @if (isOwnerWithMembers()) {
              @if (pendingOutgoingRequestId()) {
                <div class="pending-request-info">
                  <mat-icon color="warn" aria-hidden="true">hourglass_empty</mat-icon>
                  <div>
                    <p><strong>Deletion request pending</strong></p>
                    <p class="secondary-text">
                      Waiting for the other member to accept or reject your deletion request.
                    </p>
                  </div>
                  <button mat-stroked-button [disabled]="loading()" (click)="cancelDeleteRequest()">
                    Cancel Request
                  </button>
                </div>
              } @else {
                <p class="danger-description">
                  As the household owner, you must select another member to receive your deletion request.
                  They can accept (becoming the new owner) or reject (which deletes the entire household).
                </p>
                <mat-form-field appearance="outline">
                  <mat-label>Send request to</mat-label>
                  <mat-select [(ngModel)]="selectedTargetId">
                    @for (member of otherMembers(); track member.userId) {
                      <mat-option [value]="member.userId">{{ member.firstName }} {{ member.lastName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-flat-button color="warn" [disabled]="loading() || !selectedTargetId" (click)="sendDeleteRequest()">
                  <mat-icon aria-hidden="true">send</mat-icon> Send Deletion Request
                </button>
              }
            } @else {
              <!-- Member or sole owner: simple delete -->
              <p class="danger-description">
                @if (isSoleOwner()) {
                  Deleting your account will permanently delete the household and all its data.
                } @else {
                  Deleting your account will remove you from the household. Your personal expenses, savings, and salary records will be deleted.
                }
                This action cannot be undone.
              </p>
              <button mat-flat-button color="warn" [disabled]="loading()" (click)="deleteAccount()">
                <mat-icon aria-hidden="true">delete_forever</mat-icon> Delete My Account
              </button>
            }
          </div>
        </mat-expansion-panel>
      </mat-accordion>
    </div>
  `,
  styles: [`
    .settings-container { max-width: 600px; margin: 16px auto; }
    .warn-panel { border-left: 4px solid var(--mat-sys-error); }
    .danger-panel { border-left: 4px solid var(--mat-sys-error); }
    .danger-zone { display: flex; flex-direction: column; gap: var(--space-md); padding: var(--space-sm) 0; }
    .danger-description { color: var(--mat-sys-on-surface-variant); margin: 0; }
    .secondary-text { color: var(--mat-sys-on-surface-variant); font-size: 0.875rem; }
    .delete-request-info { display: flex; flex-direction: column; gap: var(--space-md); }
    .delete-request-info p { margin: 0; }
    .action-row { display: flex; gap: var(--space-md); flex-wrap: wrap; }
    .pending-request-info { display: flex; align-items: flex-start; gap: var(--space-md); }
    .pending-request-info > div { flex: 1; }
    .pending-request-info p { margin: 0; }
    mat-form-field { width: 100%; }
    mat-icon[fontIcon], mat-icon { vertical-align: middle; margin-right: 4px; }
    mat-panel-title mat-icon { margin-right: 8px; font-size: 20px; height: 20px; width: 20px; }
  `],
})
export class SettingsComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  readonly householdStore = inject(HouseholdStore);
  readonly loading = signal(false);

  readonly pendingIncomingRequest = signal<PendingDeleteRequest | null>(null);
  readonly pendingOutgoingRequestId = signal<string | null>(null);
  selectedTargetId = '';

  readonly isOwnerWithMembers = computed(() =>
    this.householdStore.isOwner() && this.householdStore.members().length > 1
  );

  readonly isSoleOwner = computed(() =>
    this.householdStore.isOwner() && this.householdStore.members().length === 1
  );

  readonly otherMembers = computed(() => {
    const userId = this.authService.currentUser()?.id;
    return this.householdStore.members().filter(m => m.userId !== userId && m.role !== HouseholdRole.OWNER);
  });

  ngOnInit(): void {
    this.householdStore.loadHousehold();
    this.loadPendingRequests();
  }

  private loadPendingRequests(): void {
    this.api.get<PendingDeleteRequest[]>('/users/delete-account-requests').pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: requests => {
        this.pendingIncomingRequest.set(requests[0] ?? null);
      },
    });
  }

  onUpdateProfile(dto: UpdateProfileRequest): void {
    this.loading.set(true);
    this.api.put<MessageResponse>('/users/me', dto).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.snackBar.open('Profile updated', '', { duration: 3000 });
        this.loading.set(false);
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Update failed', '', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  onChangePassword(dto: ChangePasswordRequest): void {
    this.loading.set(true);
    this.api.put<MessageResponse>('/users/me/password', dto).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.snackBar.open('Password changed', '', { duration: 3000 });
        this.loading.set(false);
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Change failed', '', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  deleteAccount(): void {
    const isSole = this.isSoleOwner();
    const dialogData: ConfirmDialogData = {
      title: 'Delete Account',
      message: isSole
        ? 'This will permanently delete your account AND the household with all its data. This cannot be undone.'
        : 'This will permanently delete your account and remove your data from the household. This cannot be undone.',
      confirmText: 'Delete My Account',
      cancelText: 'Cancel',
      color: 'warn',
    };

    this.dialog.open(ConfirmDialogComponent, { data: dialogData }).afterClosed().pipe(
      filter(confirmed => !!confirmed),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.loading.set(true);
      this.api.delete<MessageResponse>('/users/me').pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: () => {
          this.authService.clearAuth();
        },
        error: err => {
          this.snackBar.open(err.error?.message || 'Failed to delete account', '', { duration: 4000 });
          this.loading.set(false);
        },
      });
    });
  }

  sendDeleteRequest(): void {
    if (!this.selectedTargetId) return;

    const target = this.otherMembers().find(m => m.userId === this.selectedTargetId);
    const dialogData: ConfirmDialogData = {
      title: 'Send Deletion Request',
      message: `Send a deletion request to ${target?.firstName} ${target?.lastName}? They can accept (becoming the new household owner, your account will be deleted) or reject (the entire household and all its data will be permanently deleted).`,
      confirmText: 'Send Request',
      cancelText: 'Cancel',
      color: 'warn',
    };

    this.dialog.open(ConfirmDialogComponent, { data: dialogData }).afterClosed().pipe(
      filter(confirmed => !!confirmed),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.loading.set(true);
      const body: RequestAccountDeletionRequest = { targetMemberId: this.selectedTargetId };
      this.api.post<{ requestId: string }>('/users/me/delete-account-request', body).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: res => {
          this.pendingOutgoingRequestId.set(res.requestId);
          this.snackBar.open('Deletion request sent', '', { duration: 3000 });
          this.loading.set(false);
        },
        error: err => {
          this.snackBar.open(err.error?.message || 'Failed to send request', '', { duration: 4000 });
          this.loading.set(false);
        },
      });
    });
  }

  cancelDeleteRequest(): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Cancel Deletion Request',
        message: 'Are you sure you want to cancel your account deletion request?',
        confirmText: 'Yes, Cancel It',
        cancelText: 'Keep It',
      } as ConfirmDialogData,
    }).afterClosed().pipe(
      filter(confirmed => !!confirmed),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.loading.set(true);
      this.api.delete<MessageResponse>('/users/me/delete-account-request').pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: () => {
          this.pendingOutgoingRequestId.set(null);
          this.snackBar.open('Request cancelled', '', { duration: 3000 });
          this.loading.set(false);
        },
        error: err => {
          this.snackBar.open(err.error?.message || 'Failed to cancel', '', { duration: 4000 });
          this.loading.set(false);
        },
      });
    });
  }

  respondToDeleteRequest(accept: boolean): void {
    const request = this.pendingIncomingRequest();
    if (!request) return;

    const message = accept
      ? `Accept this request? You will become the new household owner and ${request.ownerFirstName}'s account will be permanently deleted.`
      : `Reject this request? The entire household "${request.householdName}" and all its data will be permanently deleted for all members.`;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: accept ? 'Accept Deletion Request' : 'Reject Deletion Request',
        message,
        confirmText: accept ? 'Accept' : 'Reject & Delete Household',
        cancelText: 'Cancel',
        color: 'warn',
      } as ConfirmDialogData,
    }).afterClosed().pipe(
      filter(confirmed => !!confirmed),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.loading.set(true);
      const body: RespondToDeleteRequest = { accept };
      this.api.post<MessageResponse>(`/users/delete-account-requests/${request.requestId}/respond`, body).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: res => {
          this.snackBar.open(res.message, '', { duration: 5000 });
          this.pendingIncomingRequest.set(null);
          this.loading.set(false);
          // Reload household data since it may have changed
          this.householdStore.loadHousehold();
        },
        error: err => {
          this.snackBar.open(err.error?.message || 'Failed to respond', '', { duration: 4000 });
          this.loading.set(false);
        },
      });
    });
  }
}
