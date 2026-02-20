export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PendingDeleteRequest {
  requestId: string;
  ownerId: string;
  ownerFirstName: string;
  ownerLastName: string;
  householdName: string;
  requestedAt: string;
}

export interface RequestAccountDeletionRequest {
  targetMemberId: string;
}

export interface RespondToDeleteRequest {
  accept: boolean;
}
