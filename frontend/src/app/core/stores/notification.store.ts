import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  readonly pendingApprovalsCount = signal(0);
  readonly pendingInvitationsCount = signal(0);

  setPendingApprovalsCount(count: number): void {
    this.pendingApprovalsCount.set(count);
  }

  setPendingInvitationsCount(count: number): void {
    this.pendingInvitationsCount.set(count);
  }

  reset(): void {
    this.pendingApprovalsCount.set(0);
    this.pendingInvitationsCount.set(0);
  }
}
