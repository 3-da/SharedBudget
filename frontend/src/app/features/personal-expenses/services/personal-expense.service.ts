import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Expense, CreateExpenseRequest, UpdateExpenseRequest, MessageResponse } from '../../../shared/models';

@Injectable({ providedIn: 'root' })
export class PersonalExpenseService {
  private readonly api = inject(ApiService);

  list(month?: number, year?: number): Observable<Expense[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year);
    return this.api.get<Expense[]>('/expenses/personal', params);
  }

  get(id: string): Observable<Expense> {
    return this.api.get<Expense>(`/expenses/personal/${id}`);
  }

  create(dto: CreateExpenseRequest): Observable<Expense> {
    return this.api.post<Expense>('/expenses/personal', dto);
  }

  update(id: string, dto: UpdateExpenseRequest): Observable<Expense> {
    return this.api.put<Expense>(`/expenses/personal/${id}`, dto);
  }

  delete(id: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/expenses/personal/${id}`);
  }

  getSkipStatuses(month: number, year: number): Observable<string[]> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.api.get<string[]>('/expenses/personal/skip-statuses', params);
  }
}
