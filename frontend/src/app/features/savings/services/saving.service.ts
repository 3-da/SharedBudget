import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Saving, UpsertSavingRequest } from '../../../shared/models/saving.model';

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

  upsertPersonal(dto: UpsertSavingRequest): Observable<Saving> {
    return this.api.put<Saving>('/savings/me', dto);
  }

  getHousehold(month?: number, year?: number): Observable<Saving[]> {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return this.api.get<Saving[]>(`/savings/household${qs ? '?' + qs : ''}`);
  }

  upsertShared(dto: UpsertSavingRequest): Observable<Saving> {
    return this.api.put<Saving>('/savings/shared', dto);
  }
}
