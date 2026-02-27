import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cashOutline,
  walletOutline,
  settingsOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-more',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonIcon, IonLabel,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>More</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item button (click)="navigate('/tabs/more/salary')">
          <ion-icon name="cash-outline" slot="start" />
          <ion-label>Salary</ion-label>
        </ion-item>
        <ion-item button (click)="navigate('/tabs/more/savings')">
          <ion-icon name="wallet-outline" slot="start" />
          <ion-label>Savings</ion-label>
        </ion-item>
        <ion-item button (click)="navigate('/tabs/more/settings')">
          <ion-icon name="settings-outline" slot="start" />
          <ion-label>Settings</ion-label>
        </ion-item>
        <ion-item button (click)="logout()" class="logout-item">
          <ion-icon name="log-out-outline" slot="start" color="danger" />
          <ion-label color="danger">Logout</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class MorePage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  constructor() {
    addIcons({ cashOutline, walletOutline, settingsOutline, logOutOutline });
  }

  navigate(path: string): void {
    this.router.navigateByUrl(path);
  }

  logout(): void {
    this.authService.logout().subscribe();
  }
}
