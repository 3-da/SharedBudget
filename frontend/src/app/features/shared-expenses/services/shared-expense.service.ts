import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest, SkipExpenseRequest, Approval } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class SharedExpenseService {
  private readonly api = inject(ApiService);

  list(month?: number, year?: number): Observable<Expense[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year);
    return this.api.get<Expense[]>('/expenses/shared', params);
  }

  get(id: string): Observable<Expense> {
    return this.api.get<Expense>(`/expenses/shared/${id}`);
  }

  proposeCreate(dto: CreateExpenseRequest): Observable<Approval> {
    return this.api.post<Approval>('/expenses/shared', dto);
  }

  proposeUpdate(id: string, dto: UpdateExpenseRequest): Observable<Approval> {
    return this.api.put<Approval>(`/expenses/shared/${id}`, dto);
  }

  proposeDelete(id: string): Observable<Approval> {
    return this.api.delete<Approval>(`/expenses/shared/${id}`);
  }

  proposeSkip(id: string, dto: SkipExpenseRequest): Observable<Approval> {
    return this.api.patch<Approval>(`/expenses/shared/${id}/skip`, dto);
  }

  proposeUnskip(id: string, dto: SkipExpenseRequest): Observable<Approval> {
    return this.api.patch<Approval>(`/expenses/shared/${id}/unskip`, dto);
  }

  getSkipStatuses(month: number, year: number): Observable<string[]> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.api.get<string[]>('/expenses/shared/skip-statuses', params);
  }
}
