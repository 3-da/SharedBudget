import { Body, Controller, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApprovalService } from './approval.service';
import { AcceptApprovalDto } from './dto/accept-approval.dto';
import { RejectApprovalDto } from './dto/reject-approval.dto';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';
import { ApprovalResponseDto } from './dto/approval-response.dto';
import {
    AcceptApprovalEndpoint,
    ListApprovalHistoryEndpoint,
    ListPendingApprovalsEndpoint,
    RejectApprovalEndpoint,
} from './decorators/api-approval.decorators';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalController {
    constructor(private readonly approvalService: ApprovalService) {}

    @ListPendingApprovalsEndpoint()
    async listPendingApprovals(@CurrentUser('id') userId: string): Promise<ApprovalResponseDto[]> {
        return this.approvalService.listPendingApprovals(userId);
    }

    @ListApprovalHistoryEndpoint()
    async listApprovalHistory(@CurrentUser('id') userId: string, @Query() query: ListApprovalsQueryDto): Promise<ApprovalResponseDto[]> {
        return this.approvalService.listApprovalHistory(userId, query);
    }

    @AcceptApprovalEndpoint()
    async acceptApproval(@CurrentUser('id') userId: string, @Param('id') approvalId: string, @Body() dto: AcceptApprovalDto): Promise<ApprovalResponseDto> {
        return this.approvalService.acceptApproval(userId, approvalId, dto);
    }

    @RejectApprovalEndpoint()
    async rejectApproval(@CurrentUser('id') userId: string, @Param('id') approvalId: string, @Body() dto: RejectApprovalDto): Promise<ApprovalResponseDto> {
        return this.approvalService.rejectApproval(userId, approvalId, dto);
    }
}
