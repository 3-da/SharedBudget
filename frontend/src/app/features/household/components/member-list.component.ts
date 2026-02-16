import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { HouseholdMember } from '../../../shared/models/household.model';
import { HouseholdRole } from '../../../shared/models/enums';
import { RelativeTimePipe } from '../../../shared/pipes/relative-time.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-member-list',
  standalone: true,
  imports: [MatListModule, MatIconModule, MatMenuModule, MatButtonModule, RelativeTimePipe],
  template: `
    <mat-list>
      @for (member of members(); track member.userId) {
        <mat-list-item>
          <mat-icon matListItemIcon>person</mat-icon>
          <span matListItemTitle class="member-title">
            {{ member.firstName }} {{ member.lastName }}
            @if (member.role === roles.OWNER) {
              <span class="owner-badge">Owner</span>
            }
          </span>
          <span matListItemLine>Joined {{ member.joinedAt | relativeTime }}</span>
          @if (isOwner() && member.role !== roles.OWNER) {
            <ng-container matListItemMeta>
              <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="'Actions for ' + member.firstName">
                <mat-icon aria-hidden="true">more_vert</mat-icon>
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
  styles: [`
    .member-title { display: inline-flex; align-items: center; gap: 8px; }
    .owner-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      white-space: nowrap;
      line-height: 1.4;
    }
  `],
})
export class MemberListComponent {
  readonly members = input.required<HouseholdMember[]>();
  readonly isOwner = input(false);
  readonly remove = output<string>();
  readonly transfer = output<string>();
  readonly roles = HouseholdRole;
}
