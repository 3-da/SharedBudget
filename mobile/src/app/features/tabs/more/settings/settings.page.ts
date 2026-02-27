import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonItem, IonButton, IonIcon,
  IonSelect, IonSelectOption,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { warningOutline, trashOutline, sendOutline } from 'ionicons/icons';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiService } from '../../../../core/api/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmAlertService } from '../../../../core/services/confirm-alert.service';
import { HouseholdStore } from '../../../household/stores/household.store';
import { ProfileFormComponent } from './components/profile-form.component';
import { ChangePasswordFormComponent } from './components/change-password-form.component';
import {
  UpdateProfileRequest,
  ChangePasswordRequest,
  PendingDeleteRequest,
  RequestAccountDeletionRequest,
  RespondToDeleteRequest,
} from '../../../../shared/models/user.model';
import { MessageResponse } from '../../../../shared/models/auth.model';
import { HouseholdRole } from '../../../../shared/models/enums';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonItem, IonButton, IonIcon,
    IonSelect, IonSelectOption,
    IonRefresher, IonRefresherContent,
    ProfileFormComponent, ChangePasswordFormComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/more" />
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Profile Section -->
      <h2 class="section-title">Profile</h2>
      <app-profile-form
        [user]="authService.currentUser()"
        [loading]="loading()"
        (save)="onUpdateProfile($event)" />

      <!-- Change Password Section -->
      <h2 class="section-title">Change Password</h2>
      <app-change-password-form
        [loading]="loading()"
        (save)="onChangePassword($event)" />

      <!-- Pending incoming deletion request -->
      @if (pendingIncomingRequest()) {
        <div class="warn-card">
          <ion-icon name="warning-outline" color="danger" />
          <div>
            <strong>Account Deletion Request</strong>
            <p>
              <strong>{{ pendingIncomingRequest()!.ownerFirstName }} {{ pendingIncomingRequest()!.ownerLastName }}</strong>
              wants to delete their account from <strong>{{ pendingIncomingRequest()!.householdName }}</strong>.
            </p>
            <p class="secondary">
              Accept = you become owner, their account is deleted.
              Reject = entire household is permanently deleted.
            </p>
            <div class="action-row">
              <ion-button size="small" [disabled]="loading()" (click)="respondToDeleteRequest(true)">
                Accept (Become Owner)
              </ion-button>
              <ion-button size="small" color="danger" fill="outline" [disabled]="loading()" (click)="respondToDeleteRequest(false)">
                Reject
              </ion-button>
            </div>
          </div>
        </div>
      }

      <!-- Danger Zone -->
      <h2 class="section-title danger">Danger Zone</h2>
      @if (isOwnerWithMembers()) {
        @if (pendingOutgoingRequestId()) {
          <div class="pending-info">
            <ion-icon name="warning-outline" color="warning" />
            <div>
              <strong>Deletion request pending</strong>
              <p class="secondary">Waiting for the other member to respond.</p>
              <ion-button size="small" fill="outline" [disabled]="loading()" (click)="cancelDeleteRequest()">
                Cancel Request
              </ion-button>
            </div>
          </div>
        } @else {
          <p class="secondary">As the owner, select a member to send your deletion request to.</p>
          <ion-item>
            <ion-select label="Send request to" [(ngModel)]="selectedTargetId" interface="action-sheet">
              @for (member of otherMembers(); track member.userId) {
                <ion-select-option [value]="member.userId">{{ member.firstName }} {{ member.lastName }}</ion-select-option>
              }
            </ion-select>
          </ion-item>
          <ion-button expand="block" color="danger" [disabled]="loading() || !selectedTargetId" (click)="sendDeleteRequest()" class="ion-margin-top">
            <ion-icon slot="start" name="send-outline" />
            Send Deletion Request
          </ion-button>
        }
      } @else {
        <p class="secondary">
          @if (isSoleOwner()) {
            Deleting your account will permanently delete the household and all its data.
          } @else {
            Deleting your account will remove you from the household. This cannot be undone.
          }
        </p>
        <ion-button expand="block" color="danger" [disabled]="loading()" (click)="deleteAccount()">
          <ion-icon slot="start" name="trash-outline" />
          Delete My Account
        </ion-button>
      }
    </ion-content>
  `,
  styles: [`
    .section-title { font-size: 1.1rem; font-weight: 600; margin: 24px 0 8px; }
    .section-title.danger { color: var(--ion-color-danger); }
    .secondary { color: var(--ion-color-medium); font-size: 0.875rem; }
    .warn-card {
      display: flex; gap: 12px; padding: 16px;
      margin: 16px 0; border-radius: 8px;
      border-left: 4px solid var(--ion-color-danger);
      background: var(--ion-color-danger-tint);
    }
    .warn-card ion-icon { font-size: 24px; margin-top: 2px; flex-shrink: 0; }
    .warn-card p { margin: 4px 0; }
    .action-row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
    .pending-info { display: flex; gap: 12px; padding: 12px 0; }
    .pending-info ion-icon { font-size: 24px; margin-top: 2px; flex-shrink: 0; }
    .pending-info p { margin: 4px 0; }
  `],
})
export class SettingsPage implements OnInit {
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmAlert = inject(ConfirmAlertService);
  private readonly destroyRef = inject(DestroyRef);
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

  constructor() {
    addIcons({ warningOutline, trashOutline, sendOutline });
  }

  ngOnInit(): void {
    this.householdStore.loadHousehold();
    this.loadPendingRequests();
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    this.householdStore.loadHousehold(() => refresher.complete());
    this.loadPendingRequests();
  }

  onUpdateProfile(dto: UpdateProfileRequest): void {
    this.loading.set(true);
    this.api.put<MessageResponse>('/users/me', dto).pipe(
      switchMap(() => this.authService.loadCurrentUser()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.toast.showSuccess('Profile updated'); this.loading.set(false); },
      error: err => { this.toast.showError(err.error?.message || 'Update failed'); this.loading.set(false); },
    });
  }

  onChangePassword(dto: ChangePasswordRequest): void {
    this.loading.set(true);
    this.api.put<MessageResponse>('/users/me/password', dto).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.toast.showSuccess('Password changed'); this.loading.set(false); },
      error: err => { this.toast.showError(err.error?.message || 'Change failed'); this.loading.set(false); },
    });
  }

  async deleteAccount(): Promise<void> {
    const confirmed = await this.confirmAlert.confirm({
      header: 'Delete Account',
      message: this.isSoleOwner()
        ? 'This will permanently delete your account AND the household. This cannot be undone.'
        : 'This will permanently delete your account. This cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'danger',
    });
    if (!confirmed) return;
    this.loading.set(true);
    this.api.delete<MessageResponse>('/users/me').pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.authService.clearAuth(),
      error: err => { this.toast.showError(err.error?.message || 'Failed'); this.loading.set(false); },
    });
  }

  async sendDeleteRequest(): Promise<void> {
    if (!this.selectedTargetId) return;
    const target = this.otherMembers().find(m => m.userId === this.selectedTargetId);
    const confirmed = await this.confirmAlert.confirm({
      header: 'Send Deletion Request',
      message: `Send request to ${target?.firstName} ${target?.lastName}?`,
      confirmText: 'Send',
      confirmColor: 'danger',
    });
    if (!confirmed) return;
    this.loading.set(true);
    const body: RequestAccountDeletionRequest = { targetMemberId: this.selectedTargetId };
    this.api.post<{ requestId: string }>('/users/me/delete-account-request', body).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => { this.pendingOutgoingRequestId.set(res.requestId); this.toast.showSuccess('Request sent'); this.loading.set(false); },
      error: err => { this.toast.showError(err.error?.message || 'Failed'); this.loading.set(false); },
    });
  }

  async cancelDeleteRequest(): Promise<void> {
    const confirmed = await this.confirmAlert.confirm({
      header: 'Cancel Request',
      message: 'Cancel your account deletion request?',
    });
    if (!confirmed) return;
    this.loading.set(true);
    this.api.delete<MessageResponse>('/users/me/delete-account-request').pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => { this.pendingOutgoingRequestId.set(null); this.toast.showSuccess('Request cancelled'); this.loading.set(false); },
      error: err => { this.toast.showError(err.error?.message || 'Failed'); this.loading.set(false); },
    });
  }

  async respondToDeleteRequest(accept: boolean): Promise<void> {
    const request = this.pendingIncomingRequest();
    if (!request) return;
    const confirmed = await this.confirmAlert.confirm({
      header: accept ? 'Accept Request' : 'Reject Request',
      message: accept
        ? `Accept? You will become the new owner and ${request.ownerFirstName}'s account will be deleted.`
        : `Reject? The entire household and all data will be permanently deleted.`,
      confirmText: accept ? 'Accept' : 'Reject',
      confirmColor: 'danger',
    });
    if (!confirmed) return;
    this.loading.set(true);
    const body: RespondToDeleteRequest = { accept };
    this.api.post<MessageResponse>(`/users/delete-account-requests/${request.requestId}/respond`, body).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.toast.showSuccess(res.message);
        this.pendingIncomingRequest.set(null);
        this.loading.set(false);
        this.householdStore.loadHousehold();
      },
      error: err => { this.toast.showError(err.error?.message || 'Failed'); this.loading.set(false); },
    });
  }

  private loadPendingRequests(): void {
    this.api.get<PendingDeleteRequest[]>('/users/delete-account-requests').pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: requests => this.pendingIncomingRequest.set(requests[0] ?? null),
    });
  }
}
