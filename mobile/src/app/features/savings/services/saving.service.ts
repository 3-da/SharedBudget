import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Saving, AddSavingRequest, WithdrawSavingRequest, SharedWithdrawalResponse } from '../../../shared/models/saving.model';

@Injectable({ providedIn: 'root' })
export class SavingService {
  private readonly api = inject(ApiService);

  getMine(month?: number, year?: number): Observable<Saving[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', String(month));
    if (year) params = params.set('year', String(year));
    return this.api.get<Saving[]>('/savings/me', params);
  }

  addPersonal(dto: AddSavingRequest): Observable<Saving> {
    return this.api.post<Saving>('/savings/personal/add', dto);
  }

  withdrawPersonal(dto: WithdrawSavingRequest): Observable<Saving> {
    return this.api.post<Saving>('/savings/personal/withdraw', dto);
  }

  getHousehold(month?: number, year?: number): Observable<Saving[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', String(month));
    if (year) params = params.set('year', String(year));
    return this.api.get<Saving[]>('/savings/household', params);
  }

  addShared(dto: AddSavingRequest): Observable<Saving> {
    return this.api.post<Saving>('/savings/shared/add', dto);
  }

  withdrawShared(dto: WithdrawSavingRequest): Observable<SharedWithdrawalResponse> {
    return this.api.post<SharedWithdrawalResponse>('/savings/shared/withdraw', dto);
  }
}
