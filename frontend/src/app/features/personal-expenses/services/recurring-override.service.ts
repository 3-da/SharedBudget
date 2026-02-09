import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { RecurringOverride, UpsertOverrideRequest, UpdateDefaultAmountRequest } from '../../../shared/models/recurring-override.model';
import { MessageResponse } from '../../../shared/models/auth.model';

@Injectable({ providedIn: 'root' })
export class RecurringOverrideService {
  private readonly api = inject(ApiService);

  upsertOverride(expenseId: string, year: number, month: number, dto: UpsertOverrideRequest): Observable<RecurringOverride> {
    return this.api.put<RecurringOverride>(`/expenses/${expenseId}/override/${year}/${month}`, dto);
  }

  updateDefaultAmount(expenseId: string, dto: UpdateDefaultAmountRequest): Observable<MessageResponse> {
    return this.api.put<MessageResponse>(`/expenses/${expenseId}/default-amount`, dto);
  }

  listOverrides(expenseId: string): Observable<RecurringOverride[]> {
    return this.api.get<RecurringOverride[]>(`/expenses/${expenseId}/overrides`);
  }
}
