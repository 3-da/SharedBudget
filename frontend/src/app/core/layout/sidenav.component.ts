import { Component, inject, output, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { ApprovalStore } from '../../features/approvals/stores/approval.store';


interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
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
            [matBadge]="item.route === '/approvals' && approvalStore.pendingCount() > 0 ? approvalStore.pendingCount() : null"
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
  readonly approvalStore = inject(ApprovalStore);
  navClick = output();

  readonly navItems: NavItem[] = [
    { icon: 'home', label: 'Household', route: '/household' },
    { icon: 'receipt_long', label: 'My Expenses', route: '/expenses/personal' },
    { icon: 'group', label: 'Shared Expenses', route: '/expenses/shared' },
    { icon: 'fact_check', label: 'Approvals', route: '/approvals' },
    { icon: 'payments', label: 'Salary', route: '/salary' },
    { icon: 'savings', label: 'Savings', route: '/savings' },
  ];

  ngOnInit(): void {
    this.approvalStore.loadPending();
  }
}
