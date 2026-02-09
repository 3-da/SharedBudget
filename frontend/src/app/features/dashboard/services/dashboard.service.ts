import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { DashboardOverview, MarkSettlementPaidResponse } from '../../../shared/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getOverview(): Observable<DashboardOverview> {
    return this.api.get<DashboardOverview>('/dashboard');
  }

  markSettlementPaid(): Observable<MarkSettlementPaidResponse> {
    return this.api.post<MarkSettlementPaidResponse>('/dashboard/settlement/mark-paid');
  }
}
