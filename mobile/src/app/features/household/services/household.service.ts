import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { Household, CreateHouseholdRequest, JoinByCodeRequest, TransferOwnershipRequest } from '../../../shared/models/household.model';
import { MessageResponse } from '../../../shared/models/auth.model';

@Injectable({ providedIn: 'root' })
export class HouseholdService {
  private readonly api = inject(ApiService);

  getMine(): Observable<Household> {
    return this.api.get<Household>('/household/mine');
  }

  create(dto: CreateHouseholdRequest): Observable<Household> {
    return this.api.post<Household>('/household', dto);
  }

  joinByCode(dto: JoinByCodeRequest): Observable<Household> {
    return this.api.post<Household>('/household/join', dto);
  }

  regenerateCode(): Observable<Household> {
    return this.api.post<Household>('/household/regenerate-code');
  }

  leave(): Observable<MessageResponse> {
    return this.api.post<MessageResponse>('/household/leave');
  }

  removeMember(userId: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/household/members/${userId}`);
  }

  transferOwnership(dto: TransferOwnershipRequest): Observable<Household> {
    return this.api.post<Household>('/household/transfer-ownership', dto);
  }
}
