import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  IonList, IonItem, IonLabel, IonIcon, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline, swapHorizontalOutline, personRemoveOutline } from 'ionicons/icons';
import { HouseholdMember } from '../../../../shared/models/household.model';
import { HouseholdRole } from '../../../../shared/models/enums';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-member-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonList, IonItem, IonLabel, IonIcon, IonBadge,
    IonItemSliding, IonItemOptions, IonItemOption,
    RelativeTimePipe,
  ],
  template: `
    <ion-list>
      @for (member of members(); track member.userId) {
        <ion-item-sliding>
          <ion-item>
            <ion-icon name="person-outline" slot="start"></ion-icon>
            <ion-label>
              <h2>
                {{ member.firstName }} {{ member.lastName }}
                @if (member.role === roles.OWNER) {
                  <ion-badge color="primary">Owner</ion-badge>
                }
              </h2>
              <p>Joined {{ member.joinedAt | relativeTime }}</p>
            </ion-label>
          </ion-item>
          @if (isOwner() && member.role !== roles.OWNER) {
            <ion-item-options side="end">
              <ion-item-option color="primary" (click)="transfer.emit(member.userId)">
                <ion-icon slot="icon-only" name="swap-horizontal-outline"></ion-icon>
              </ion-item-option>
              <ion-item-option color="danger" (click)="remove.emit(member.userId)">
                <ion-icon slot="icon-only" name="person-remove-outline"></ion-icon>
              </ion-item-option>
            </ion-item-options>
          }
        </ion-item-sliding>
      }
    </ion-list>
  `,
})
export class MemberListComponent {
  readonly members = input.required<HouseholdMember[]>();
  readonly isOwner = input(false);
  readonly remove = output<string>();
  readonly transfer = output<string>();
  readonly roles = HouseholdRole;

  constructor() {
    addIcons({ personOutline, swapHorizontalOutline, personRemoveOutline });
  }
}
