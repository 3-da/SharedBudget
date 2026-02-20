import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Saving, AddSavingRequest, WithdrawSavingRequest, SharedWithdrawalResponse } from '../../../shared/models/saving.model';

@Injectable({ providedIn: 'root' })
export class SavingService {
  private readonly api = inject(ApiService);

  getMine(month?: number, year?: number): Observable<Saving[]> {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return this.api.get<Saving[]>(`/savings/me${qs ? '?' + qs : ''}`);
  }

  addPersonal(dto: AddSavingRequest): Observable<Saving> {
    return this.api.post<Saving>('/savings/personal/add', dto);
  }

  withdrawPersonal(dto: WithdrawSavingRequest): Observable<Saving> {
    return this.api.post<Saving>('/savings/personal/withdraw', dto);
  }

  getHousehold(month?: number, year?: number): Observable<Saving[]> {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return this.api.get<Saving[]>(`/savings/household${qs ? '?' + qs : ''}`);
  }

  addShared(dto: AddSavingRequest): Observable<Saving> {
    return this.api.post<Saving>('/savings/shared/add', dto);
  }

  withdrawShared(dto: WithdrawSavingRequest): Observable<SharedWithdrawalResponse> {
    return this.api.post<SharedWithdrawalResponse>('/savings/shared/withdraw', dto);
  }
}
