import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Saving, UpsertSavingRequest } from '../../../shared/models/saving.model';

@Injectable({ providedIn: 'root' })
export class SavingService {
  private readonly api = inject(ApiService);

  getMine(): Observable<Saving[]> {
    return this.api.get<Saving[]>('/savings/me');
  }

  upsertPersonal(dto: UpsertSavingRequest): Observable<Saving> {
    return this.api.put<Saving>('/savings/me', dto);
  }

  getHousehold(): Observable<Saving[]> {
    return this.api.get<Saving[]>('/savings/household');
  }

  upsertShared(dto: UpsertSavingRequest): Observable<Saving> {
    return this.api.put<Saving>('/savings/shared', dto);
  }
}
