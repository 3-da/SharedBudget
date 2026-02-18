import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  readonly pendingApprovalsCount = signal(0);

  setPendingApprovalsCount(count: number): void {
    this.pendingApprovalsCount.set(count);
  }

  reset(): void {
    this.pendingApprovalsCount.set(0);
  }
}
