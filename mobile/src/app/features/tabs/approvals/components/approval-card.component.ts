import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonChip,
  IonButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline, banOutline } from 'ionicons/icons';
import { Approval } from '../../../../shared/models/approval.model';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-approval-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonChip, IonButton, IonIcon, RelativeTimePipe,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>{{ approval().action }} Expense</ion-card-title>
        <ion-card-subtitle>
          By {{ approval().requestedBy.firstName }} {{ approval().requestedBy.lastName }}
          &middot; {{ approval().createdAt | relativeTime }}
        </ion-card-subtitle>
      </ion-card-header>
      <ion-card-content>
        <div class="chips">
          <ion-chip [color]="statusColor()">{{ approval().status }}</ion-chip>
          <ion-chip color="medium">{{ approval().action }}</ion-chip>
        </div>
        @if (approval().proposedData; as data) {
          <div class="proposed-data">
            @if (data['name']) {
              <div><strong>Name:</strong> {{ data['name'] }}</div>
            }
            @if (data['amount']) {
              <div><strong>Amount:</strong> {{ data['amount'] }} EUR</div>
            }
          </div>
        }
        @if (approval().message && approval().status !== 'CANCELLED') {
          <p class="message">{{ approval().message }}</p>
        }
        @if (approval().status === 'PENDING') {
          <div class="actions">
            @if (approval().requestedBy.id === currentUserId()) {
              <ion-button fill="outline" color="warning" size="small" (click)="cancel.emit(approval().id)">
                <ion-icon slot="start" name="ban-outline" />
                Cancel
              </ion-button>
            } @else {
              <ion-button color="success" size="small" (click)="accept.emit(approval().id)">
                <ion-icon slot="start" name="checkmark-outline" />
                Accept
              </ion-button>
              <ion-button color="danger" size="small" (click)="reject.emit(approval().id)">
                <ion-icon slot="start" name="close-outline" />
                Reject
              </ion-button>
            }
          </div>
        }
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    .proposed-data { margin: 8px 0; }
    .message { font-style: italic; color: var(--ion-color-medium); }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
  `],
})
export class ApprovalCardComponent {
  readonly approval = input.required<Approval>();
  readonly currentUserId = input<string | null>(null);
  readonly accept = output<string>();
  readonly reject = output<string>();
  readonly cancel = output<string>();

  constructor() {
    addIcons({ checkmarkOutline, closeOutline, banOutline });
  }

  readonly statusColor = computed(() => {
    switch (this.approval().status) {
      case 'ACCEPTED': return 'success';
      case 'REJECTED': return 'danger';
      case 'CANCELLED': return 'warning';
      default: return 'primary';
    }
  });
}
