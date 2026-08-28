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
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule, MatBadgeModule],
  template: `
    <div class="navigation-intro">
      <span class="eyebrow">Workspace</span>
      <strong>Our household</strong>
      <span>Plan clearly. Decide together.</span>
    </div>
    <mat-nav-list aria-label="Primary navigation">
      @for (section of navigationSections; track section.label) {
        <p class="section-label">{{ section.label }}</p>
        @for (item of section.items; track item.route) {
          <a mat-list-item
             [routerLink]="item.route"
             routerLinkActive="active"
             (click)="navClick.emit()">
            <mat-icon matListItemIcon
              aria-hidden="true"
              [matBadge]="getBadgeCountForNavigationRoute(item.route)"
              matBadgeColor="warn">{{ item.icon }}</mat-icon>
            <span matListItemTitle>{{ item.label }}</span>
          </a>
        }
      }
    </mat-nav-list>
    <div class="navigation-footer">
      <mat-icon aria-hidden="true">verified_user</mat-icon>
      <div><strong>Private by design</strong><span>Your household data stays protected.</span></div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100%; padding: 22px 14px; box-sizing: border-box; }
    .navigation-intro { display: flex; flex-direction: column; gap: 3px; padding: 8px 12px 24px; }
    .navigation-intro strong { color: var(--color-ink); font-size: 0.95rem; letter-spacing: -0.02em; }
    .navigation-intro > span:last-child { color: var(--color-ink-muted); font-size: 0.75rem; }
    .eyebrow,
    .section-label { color: var(--color-ink-muted); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; }
    .section-label { margin: 17px 12px 6px; }
    mat-nav-list { padding: 0; }
    a[mat-list-item] { height: 46px; margin: 3px 0; border-radius: 11px; color: var(--color-ink-muted); }
    a[mat-list-item] mat-icon { color: inherit; }
    a[mat-list-item].active { background: var(--color-brand-soft); color: var(--color-brand-strong); font-weight: 650; }
    .navigation-footer { display: flex; gap: 10px; margin: auto 4px 0; padding: 14px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-panel-subtle); }
    .navigation-footer mat-icon { color: var(--color-positive); font-size: 20px; }
    .navigation-footer div { display: flex; flex-direction: column; gap: 3px; }
    .navigation-footer strong { color: var(--color-ink); font-size: 0.72rem; }
    .navigation-footer span { color: var(--color-ink-muted); font-size: 0.65rem; line-height: 1.4; }
  `],
})
export class SidenavComponent implements OnInit {
  readonly notificationStore = inject(NotificationStore);
  private readonly householdStore = inject(HouseholdStore);
  navClick = output();

  readonly navigationSections = [
    {
      label: 'Overview',
      items: [{ icon: 'space_dashboard', label: 'Household', route: '/household' }],
    },
    {
      label: 'Money',
      items: [
        { icon: 'receipt_long', label: 'My expenses', route: '/expenses/personal' },
        { icon: 'group_work', label: 'Shared expenses', route: '/expenses/shared' },
        { icon: 'payments', label: 'Salary', route: '/salary' },
        { icon: 'savings', label: 'Savings', route: '/savings' },
      ],
    },
    {
      label: 'Household',
      items: [
        { icon: 'fact_check', label: 'Approvals', route: '/approvals' },
        { icon: 'mail_outline', label: 'Invitations', route: '/household/invitations' },
      ],
    },
  ];

  ngOnInit(): void {
    this.householdStore.loadInvitations();
  }

  getBadgeCountForNavigationRoute(route: string): number | null {
    if (route === '/approvals' && this.notificationStore.pendingApprovalsCount() > 0) {
      return this.notificationStore.pendingApprovalsCount();
    }
    if (route === '/household/invitations' && this.notificationStore.pendingInvitationsCount() > 0) {
      return this.notificationStore.pendingInvitationsCount();
    }
    return null;
  }
}
