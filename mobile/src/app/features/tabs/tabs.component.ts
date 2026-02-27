import { Component, inject } from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonBadge,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  walletOutline,
  peopleOutline,
  checkmarkCircleOutline,
  ellipsisHorizontal,
} from 'ionicons/icons';
import { NotificationStore } from '../../core/stores/notification.store';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard">
          <ion-icon name="home-outline" />
          <ion-label>Dashboard</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="expenses">
          <ion-icon name="wallet-outline" />
          <ion-label>Expenses</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="household">
          <ion-icon name="people-outline" />
          <ion-label>Household</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="approvals">
          <ion-icon name="checkmark-circle-outline" />
          <ion-label>Approvals</ion-label>
          @if (notificationStore.pendingApprovalsCount() > 0) {
            <ion-badge color="danger">{{ notificationStore.pendingApprovalsCount() }}</ion-badge>
          }
        </ion-tab-button>
        <ion-tab-button tab="more">
          <ion-icon name="ellipsis-horizontal" />
          <ion-label>More</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsComponent {
  readonly notificationStore = inject(NotificationStore);

  constructor() {
    addIcons({
      homeOutline,
      walletOutline,
      peopleOutline,
      checkmarkCircleOutline,
      ellipsisHorizontal,
    });
  }
}
