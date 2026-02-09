import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Approval, AcceptApprovalRequest, RejectApprovalRequest } from '../../../shared/models/approval.model';

@Injectable({ providedIn: 'root' })
export class ApprovalService {
  private readonly api = inject(ApiService);

  getPending(): Observable<Approval[]> {
    return this.api.get<Approval[]>('/approvals');
  }

  getHistory(): Observable<Approval[]> {
    return this.api.get<Approval[]>('/approvals/history');
  }

  accept(id: string, dto?: AcceptApprovalRequest): Observable<Approval> {
    return this.api.put<Approval>(`/approvals/${id}/accept`, dto ?? {});
  }

  reject(id: string, dto: RejectApprovalRequest): Observable<Approval> {
    return this.api.put<Approval>(`/approvals/${id}/reject`, dto);
  }
}
