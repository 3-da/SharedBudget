import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons,
  IonList, IonItem, IonLabel, IonButton, IonIcon, IonSpinner, IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline, mailOutline } from 'ionicons/icons';
import { HouseholdStore } from '../../household/stores/household.store';
import { InvitationService } from '../../household/services/invitation.service';
import { ToastService } from '../../../core/services/toast.service';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-pending-invitations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons,
    IonList, IonItem, IonLabel, IonButton, IonIcon, IonSpinner, IonText,
    RelativeTimePipe,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/household"></ion-back-button>
        </ion-buttons>
        <ion-title>Invitations</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (store.loading()) {
        <div class="spinner-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (store.invitations().length === 0) {
        <div class="empty-state">
          <ion-icon name="mail-outline" class="empty-icon"></ion-icon>
          <h3>No Pending Invitations</h3>
          <ion-text color="medium"><p>You have no household invitations.</p></ion-text>
        </div>
      } @else {
        <ion-list>
          @for (inv of store.invitations(); track inv.id) {
            <ion-item>
              <ion-label>
                <h2>{{ inv.householdName }}</h2>
                <p>Invited by {{ inv.senderFirstName }} {{ inv.senderLastName }} · {{ inv.createdAt | relativeTime }}</p>
              </ion-label>
              <ion-button fill="solid" size="small" (click)="respond(inv.id, true)">
                <ion-icon name="checkmark-outline" slot="icon-only"></ion-icon>
              </ion-button>
              <ion-button fill="outline" color="danger" size="small" (click)="respond(inv.id, false)">
                <ion-icon name="close-outline" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-item>
          }
        </ion-list>
      }
    </ion-content>
  `,
  styles: [`
    .spinner-container { display: flex; justify-content: center; padding: 48px 0; }
    .empty-state { text-align: center; padding: 48px 16px; }
    .empty-icon { font-size: 64px; color: var(--ion-color-medium); }
  `],
})
export class PendingInvitationsPage implements OnInit {
  readonly store = inject(HouseholdStore);
  private readonly invitationService = inject(InvitationService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    addIcons({ checkmarkOutline, closeOutline, mailOutline });
  }

  ngOnInit(): void {
    this.store.loadInvitations();
  }

  respond(id: string, accept: boolean): void {
    this.invitationService.respond(id, { accept }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: res => {
        this.toast.showSuccess(res.message);
        this.store.loadInvitations();
        if (accept) this.store.loadHousehold();
      },
      error: err => this.toast.showError(err.error?.message || 'Failed'),
    });
  }
}
