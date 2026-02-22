import { ChangeDetectionStrategy, Component, inject, OnInit, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationStore } from '../stores/notification.store';
import { HouseholdStore } from '../../features/household/stores/household.store';


@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule, MatBadgeModule],
  template: `
    <mat-nav-list>
      @for (item of navItems; track item.route) {
        <a mat-list-item
           [routerLink]="item.route"
           routerLinkActive="active"
           (click)="navClick.emit()">
          <mat-icon matListItemIcon
            aria-hidden="true"
            [matBadge]="getBadgeCount(item.route)"
            matBadgeColor="warn">{{ item.icon }}</mat-icon>
          <span matListItemTitle>{{ item.label }}</span>
        </a>
      }
    </mat-nav-list>
  `,
  styles: [`
    :host { display: block; padding-top: var(--space-sm); }
    .active { background: var(--mat-sys-secondary-container); }
  `],
})
export class SidenavComponent implements OnInit {
  readonly notificationStore = inject(NotificationStore);
  private readonly householdStore = inject(HouseholdStore);
  navClick = output();

  readonly navItems = [
    { icon: 'home', label: 'Household', route: '/household' },
    { icon: 'receipt_long', label: 'My Expenses', route: '/expenses/personal' },
    { icon: 'group', label: 'Shared Expenses', route: '/expenses/shared' },
    { icon: 'fact_check', label: 'Approvals', route: '/approvals' },
    { icon: 'payments', label: 'Salary', route: '/salary' },
    { icon: 'savings', label: 'Savings', route: '/savings' },
    { icon: 'mail', label: 'Invitations', route: '/household/invitations' },
  ];

  ngOnInit(): void {
    this.householdStore.loadInvitations();
  }

  getBadgeCount(route: string): number | null {
    if (route === '/approvals' && this.notificationStore.pendingApprovalsCount() > 0) {
      return this.notificationStore.pendingApprovalsCount();
    }
    if (route === '/household/invitations' && this.notificationStore.pendingInvitationsCount() > 0) {
      return this.notificationStore.pendingInvitationsCount();
    }
    return null;
  }
}
