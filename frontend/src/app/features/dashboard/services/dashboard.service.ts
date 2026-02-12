import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { DashboardOverview, MarkSettlementPaidResponse, SavingsHistoryItem } from '../../../shared/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  getOverview(mode?: 'monthly' | 'yearly', month?: number, year?: number): Observable<DashboardOverview> {
    const params = new URLSearchParams();
    if (mode && mode !== 'monthly') params.set('mode', mode);
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return this.api.get<DashboardOverview>(`/dashboard${qs ? '?' + qs : ''}`);
  }

  getSavingsHistory(): Observable<SavingsHistoryItem[]> {
    return this.api.get<SavingsHistoryItem[]>('/dashboard/savings-history');
  }

  markSettlementPaid(): Observable<MarkSettlementPaidResponse> {
    return this.api.post<MarkSettlementPaidResponse>('/dashboard/settlement/mark-paid');
  }
}
