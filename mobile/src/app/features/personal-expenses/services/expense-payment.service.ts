import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { ExpensePayment, MarkPaidRequest } from '../../../shared/models/expense-payment.model';

@Injectable({ providedIn: 'root' })
export class ExpensePaymentService {
  private readonly api = inject(ApiService);

  markPaid(expenseId: string, dto: MarkPaidRequest): Observable<ExpensePayment> {
    return this.api.put<ExpensePayment>(`/expenses/${expenseId}/mark-paid`, dto);
  }

  undoPaid(expenseId: string, dto: MarkPaidRequest): Observable<ExpensePayment> {
    return this.api.put<ExpensePayment>(`/expenses/${expenseId}/undo-paid`, dto);
  }

  cancel(expenseId: string, dto: MarkPaidRequest): Observable<ExpensePayment> {
    return this.api.put<ExpensePayment>(`/expenses/${expenseId}/cancel`, dto);
  }

  getStatus(expenseId: string): Observable<ExpensePayment[]> {
    return this.api.get<ExpensePayment[]>(`/expenses/${expenseId}/payment-status`);
  }

  getBatchStatuses(month: number, year: number): Observable<ExpensePayment[]> {
    return this.api.get<ExpensePayment[]>(`/expenses/payment-status/batch?month=${month}&year=${year}`);
  }
}
