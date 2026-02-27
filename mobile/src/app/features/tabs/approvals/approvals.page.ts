import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  ModalController,
} from '@ionic/angular/standalone';
import { ApprovalStore } from '../../approvals/stores/approval.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ApprovalCardComponent } from './components/approval-card.component';
import { RejectModalComponent } from './components/reject-modal.component';

type Tab = 'pending' | 'history';

@Component({
  selector: 'app-approvals',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonSpinner,
    IonRefresher, IonRefresherContent, IonBadge,
    ApprovalCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Approvals</ion-title>
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="activeTab" (ionChange)="onTabChange($event)">
          <ion-segment-button value="pending">
            <ion-label>
              Pending
              @if (store.pendingCount() > 0) {
                <ion-badge color="danger">{{ store.pendingCount() }}</ion-badge>
              }
            </ion-label>
          </ion-segment-button>
          <ion-segment-button value="history">
            <ion-label>History</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="onRefresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      @if (store.loading()) {
        <div class="center-spinner">
          <ion-spinner name="crescent" />
        </div>
      } @else if (activeTab === 'pending') {
        @if (store.pending().length === 0) {
          <div class="empty-state">
            <p>No pending approvals</p>
          </div>
        } @else {
          @for (a of store.pending(); track a.id) {
            <app-approval-card
              [approval]="a"
              [currentUserId]="currentUserId()"
              (accept)="onAccept($event)"
              (reject)="onReject($event)"
              (cancel)="onCancel($event)" />
          }
        }
      } @else {
        @if (store.history().length === 0) {
          <div class="empty-state">
            <p>No reviewed approvals yet</p>
          </div>
        } @else {
          @for (a of store.history(); track a.id) {
            <app-approval-card
              [approval]="a"
              [currentUserId]="currentUserId()" />
          }
        }
      }
    </ion-content>
  `,
  styles: [`
    .center-spinner { display: flex; justify-content: center; padding: 48px 0; }
    .empty-state { text-align: center; padding: 48px 16px; color: var(--ion-color-medium); }
    ion-badge { margin-left: 6px; vertical-align: middle; }
  `],
})
export class ApprovalsPage implements OnInit {
  readonly store = inject(ApprovalStore);
  private readonly authService = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);
  activeTab: Tab = 'pending';

  ngOnInit(): void {
    this.store.loadPending();
    this.store.loadHistory();
  }

  onTabChange(event: CustomEvent): void {
    this.activeTab = event.detail.value as Tab;
  }

  onRefresh(event: CustomEvent): void {
    const refresher = event.target as HTMLIonRefresherElement;
    let remaining = 2;
    const done = () => { if (--remaining === 0) refresher.complete(); };
    this.store.loadPending(done);
    this.store.loadHistory(done);
  }

  onAccept(id: string): void {
    this.store.accept(id);
  }

  async onReject(id: string): Promise<void> {
    const modal = await this.modalCtrl.create({ component: RejectModalComponent });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'confirm' && data) {
      this.store.reject(id, data);
    }
  }

  onCancel(id: string): void {
    this.store.cancel(id);
  }
}
