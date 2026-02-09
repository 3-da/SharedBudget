import { Component, inject, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { HouseholdMember } from '../../../shared/models/household.model';
import { HouseholdRole } from '../../../shared/models/enums';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [MatListModule, MatIconModule, MatMenuModule, MatButtonModule, MatChipsModule, RelativeTimePipe],
  template: `
    <mat-list>
      @for (member of members(); track member.userId) {
        <mat-list-item>
          <mat-icon matListItemIcon>person</mat-icon>
          <span matListItemTitle>
            {{ member.firstName }} {{ member.lastName }}
            @if (member.role === roles.OWNER) {
              <mat-chip-set><mat-chip highlighted>Owner</mat-chip></mat-chip-set>
            }
          </span>
          <span matListItemLine>Joined {{ member.joinedAt | relativeTime }}</span>
          @if (isOwner() && member.role !== roles.OWNER) {
            <ng-container matListItemMeta>
              <button mat-icon-button [matMenuTriggerFor]="menu">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item (click)="transfer.emit(member.userId)">
                  <mat-icon>swap_horiz</mat-icon> Transfer Ownership
                </button>
                <button mat-menu-item (click)="remove.emit(member.userId)">
                  <mat-icon>person_remove</mat-icon> Remove
                </button>
              </mat-menu>
            </ng-container>
          }
        </mat-list-item>
      }
    </mat-list>
  `,
})
export class MemberListComponent {
  readonly members = input.required<HouseholdMember[]>();
  readonly isOwner = input(false);
  readonly remove = output<string>();
  readonly transfer = output<string>();
  readonly roles = HouseholdRole;
}
