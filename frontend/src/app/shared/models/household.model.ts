import { HouseholdRole, InvitationStatus } from './enums';

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  maxMembers: number;
  members: HouseholdMember[];
}

export interface HouseholdMember {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  role: HouseholdRole;
  joinedAt: string;
}

export interface HouseholdInvitation {
  id: string;
  status: InvitationStatus;
  householdId: string;
  sender: { firstName: string; lastName: string };
  householdName: string;
  createdAt: string;
}

export interface CreateHouseholdRequest {
  name: string;
}

export interface JoinByCodeRequest {
  inviteCode: string;
}

export interface InviteRequest {
  email: string;
}

export interface RespondToInvitationRequest {
  accept: boolean;
}

export interface TransferOwnershipRequest {
  targetUserId: string;
}
