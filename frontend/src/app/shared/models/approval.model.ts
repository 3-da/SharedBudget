import { ApprovalAction, ApprovalStatus } from './enums';

export interface Approval {
  id: string;
  expenseId: string | null;
  action: ApprovalAction;
  status: ApprovalStatus;
  requestedBy: { id: string; firstName: string; lastName: string };
  reviewedBy: { id: string; firstName: string; lastName: string } | null;
  message: string | null;
  proposedData: Record<string, unknown> | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AcceptApprovalRequest {
  message?: string;
}

export interface RejectApprovalRequest {
  message: string;
}
