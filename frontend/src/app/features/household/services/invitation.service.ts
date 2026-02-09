import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { HouseholdInvitation, InviteRequest, RespondToInvitationRequest } from '../../../shared/models/household.model';
import { MessageResponse } from '../../../shared/models/auth.model';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly api = inject(ApiService);

  invite(dto: InviteRequest): Observable<HouseholdInvitation> {
    return this.api.post<HouseholdInvitation>('/household/invite', dto);
  }

  getPending(): Observable<HouseholdInvitation[]> {
    return this.api.get<HouseholdInvitation[]>('/household/invitations/pending');
  }

  respond(id: string, dto: RespondToInvitationRequest): Observable<MessageResponse> {
    return this.api.post<MessageResponse>(`/household/invitations/${id}/respond`, dto);
  }

  cancel(id: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/household/invitations/${id}`);
  }
}
