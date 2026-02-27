import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner,
  IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel,
  IonRefresher, IonRefresherContent, IonText,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  copyOutline, refreshOutline, personAddOutline, exitOutline, mailOutline,
} from 'ionicons/icons';
import { RouterLink } from '@angular/router';
import { HouseholdStore } from '../../household/stores/household.store';
import { InvitationService } from '../../household/services/invitation.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmAlertService } from '../../../core/services/confirm-alert.service';
import { MemberListComponent } from './components/member-list.component';
import { CreateHouseholdFormComponent } from './components/create-household-form.component';
import { JoinByCodeFormComponent } from './components/join-by-code-form.component';
import { InviteModalComponent } from './components/invite-modal.component';

@Component({
  selector: 'app-household',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner,
    IonButton, IonIcon, IonSegment, IonSegmentButton, IonLabel,
    IonRefresher, IonRefresherContent, IonText,
    RouterLink,
    MemberListComponent, CreateHouseholdFormComponent, JoinByCodeFormComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Household</ion-title>
        @if (store.hasHousehold()) {
          <ion-button slot="end" fill="clear" routerLink="/tabs/household/invitations">
            <ion-icon name="mail-outline" slot="icon-only"></ion-icon>
          </ion-button>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      @if (store.loading()) {
        <div class="spinner-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (!store.hasHousehold()) {
        <!-- No household — Create or Join -->
        <h2 class="ion-text-center">Join or Create a Household</h2>

        <ion-segment [value]="setupTab" (ionChange)="setupTab = $any($event).detail.value">
          <ion-segment-button value="create">
            <ion-label>Create New</ion-label>
          </ion-segment-button>
          <ion-segment-button value="join">
            <ion-label>Join by Code</ion-label>
          </ion-segment-button>
        </ion-segment>

        <div class="ion-padding-top">
          @if (setupTab === 'create') {
            <app-create-household-form />
          } @else {
            <app-join-by-code-form />
          }
        </div>
      } @else {
        <!-- Has household -->
        <h2>{{ store.household()!.name }}</h2>
        <ion-text color="medium">
          <p>{{ store.members().length }} / {{ store.household()!.maxMembers }} members</p>
        </ion-text>

        @if (store.isOwner()) {
          <div class="invite-code-section">
            <span class="code-label">Invite Code:</span>
            <code class="invite-code">{{ store.household()!.inviteCode }}</code>
            <ion-button fill="clear" size="small" (click)="copyCode()">
              <ion-icon name="copy-outline" slot="icon-only"></ion-icon>
            </ion-button>
            <ion-button fill="clear" size="small" (click)="store.regenerateCode()">
              <ion-icon name="refresh-outline" slot="icon-only"></ion-icon>
            </ion-button>
          </div>
        }

        <app-member-list
          [members]="store.members()"
          [isOwner]="store.isOwner()"
          (remove)="confirmRemove($event)"
          (transfer)="confirmTransfer($event)" />

        <div class="actions">
          @if (store.isOwner()) {
            <ion-button expand="block" (click)="openInviteModal()">
              <ion-icon name="person-add-outline" slot="start"></ion-icon>
              Invite Member
            </ion-button>
          }
          <ion-button expand="block" fill="outline" color="danger" (click)="confirmLeave()">
            <ion-icon name="exit-outline" slot="start"></ion-icon>
            Leave Household
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .spinner-container { display: flex; justify-content: center; padding: 48px 0; }
    .invite-code-section {
      display: flex; align-items: center; gap: 4px;
      margin: 12px 0; flex-wrap: wrap;
    }
    .invite-code {
      font-size: 18px; letter-spacing: 2px;
      padding: 4px 12px;
      background: var(--ion-color-light);
      border-radius: 4px;
    }
    .actions { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
  `],
})
export class HouseholdPage implements OnInit {
  readonly store = inject(HouseholdStore);
  private readonly modalCtrl = inject(ModalController);
  private readonly invitationService = inject(InvitationService);
  private readonly toast = inject(ToastService);
  private readonly confirmAlert = inject(ConfirmAlertService);
  private readonly destroyRef = inject(DestroyRef);

  setupTab: 'create' | 'join' = 'create';

  constructor() {
    addIcons({ copyOutline, refreshOutline, personAddOutline, exitOutline, mailOutline });
  }

  ngOnInit(): void {
    this.store.loadHousehold();
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    this.store.loadHousehold(() => refresher.complete());
  }

  async copyCode(): Promise<void> {
    await navigator.clipboard.writeText(this.store.household()!.inviteCode);
    await this.toast.showInfo('Code copied!');
  }

  async openInviteModal(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: InviteModalComponent });
    await modal.present();
    const { data: email } = await modal.onDidDismiss();
    if (!email) return;

    this.invitationService.invite({ email }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => this.toast.showSuccess('Invitation sent'),
      error: err => this.toast.showError(err.error?.message || 'Failed to invite'),
    });
  }

  async confirmRemove(userId: string): Promise<void> {
    const confirmed = await this.confirmAlert.confirm({
      header: 'Remove Member',
      message: 'Are you sure you want to remove this member?',
      confirmText: 'Remove',
      confirmColor: 'danger',
    });
    if (confirmed) this.store.removeMember(userId);
  }

  async confirmTransfer(userId: string): Promise<void> {
    const confirmed = await this.confirmAlert.confirm({
      header: 'Transfer Ownership',
      message: 'This will make the selected member the new owner. Continue?',
      confirmText: 'Transfer',
      confirmColor: 'danger',
    });
    if (confirmed) this.store.transferOwnership(userId);
  }

  async confirmLeave(): Promise<void> {
    const confirmed = await this.confirmAlert.confirm({
      header: 'Leave Household',
      message: 'Are you sure you want to leave this household?',
      confirmText: 'Leave',
      confirmColor: 'danger',
    });
    if (confirmed) this.store.leave();
  }
}
