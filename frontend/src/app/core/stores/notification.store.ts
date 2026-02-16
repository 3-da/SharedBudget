import { inject, Injectable, signal } from '@angular/core';
import { ApiService } from '../api/api.service';

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly api = inject(ApiService);
  readonly pendingApprovalsCount = signal(0);

  setPendingApprovalsCount(count: number): void {
    this.pendingApprovalsCount.set(count);
  }

  loadPendingApprovalsCount(): void {
    this.api.get<unknown[]>('/approvals').subscribe({
      next: (approvals) => this.pendingApprovalsCount.set(approvals.length),
      error: () => this.pendingApprovalsCount.set(0),
    });
  }
}
