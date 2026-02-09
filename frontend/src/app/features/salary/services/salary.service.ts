import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { SalaryResponse, UpsertSalaryRequest } from '../../../shared/models/salary.model';

@Injectable({ providedIn: 'root' })
export class SalaryService {
  private readonly api = inject(ApiService);

  getMine(): Observable<SalaryResponse> {
    return this.api.get<SalaryResponse>('/salary/me');
  }

  upsert(dto: UpsertSalaryRequest): Observable<SalaryResponse> {
    return this.api.put<SalaryResponse>('/salary/me', dto);
  }

  getMyYearly(year: number): Observable<SalaryResponse[]> {
    return this.api.get<SalaryResponse[]>(`/salary/me/yearly/${year}`);
  }

  getHousehold(): Observable<SalaryResponse[]> {
    return this.api.get<SalaryResponse[]>('/salary/household');
  }

  getByMonth(year: number, month: number): Observable<SalaryResponse[]> {
    return this.api.get<SalaryResponse[]>(`/salary/household/${year}/${month}`);
  }
}
