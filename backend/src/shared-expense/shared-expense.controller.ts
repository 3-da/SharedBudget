import { Body, Controller, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SharedExpenseService } from './shared-expense.service';
import { CreateSharedExpenseDto } from './dto/create-shared-expense.dto';
import { UpdateSharedExpenseDto } from './dto/update-shared-expense.dto';
import { SkipExpenseDto } from './dto/skip-expense.dto';
import { ListSharedExpensesQueryDto } from './dto/list-shared-expenses-query.dto';
import { SharedExpenseResponseDto } from './dto/shared-expense-response.dto';
import { ApprovalResponseDto } from '../approval/dto/approval-response.dto';
import {
    GetSharedExpenseEndpoint,
    GetSharedSkipStatusesEndpoint,
    ListSharedExpensesEndpoint,
    ProposeCreateSharedExpenseEndpoint,
    ProposeDeleteSharedExpenseEndpoint,
    ProposeSkipSharedExpenseEndpoint,
    ProposeUnskipSharedExpenseEndpoint,
    ProposeUpdateSharedExpenseEndpoint,
} from './decorators/api-shared-expense.decorators';

@ApiTags('Shared Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses/shared')
export class SharedExpenseController {
    constructor(private readonly sharedExpenseService: SharedExpenseService) {}

    @ListSharedExpensesEndpoint()
    async listSharedExpenses(@CurrentUser('id') userId: string, @Query() query: ListSharedExpensesQueryDto): Promise<SharedExpenseResponseDto[]> {
        return this.sharedExpenseService.listSharedExpenses(userId, query);
    }

    @GetSharedSkipStatusesEndpoint()
    async getSharedSkipStatuses(@CurrentUser('id') userId: string, @Query() query: ListSharedExpensesQueryDto): Promise<string[]> {
        const now = new Date();
        return this.sharedExpenseService.getSharedSkipStatuses(userId, query.month ?? now.getMonth() + 1, query.year ?? now.getFullYear());
    }

    @GetSharedExpenseEndpoint()
    async getSharedExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<SharedExpenseResponseDto> {
        return this.sharedExpenseService.getSharedExpense(userId, expenseId);
    }

    @ProposeCreateSharedExpenseEndpoint()
    async proposeCreateSharedExpense(@CurrentUser('id') userId: string, @Body() dto: CreateSharedExpenseDto): Promise<ApprovalResponseDto> {
        return this.sharedExpenseService.proposeCreateSharedExpense(userId, dto);
    }

    @ProposeUpdateSharedExpenseEndpoint()
    async proposeUpdateSharedExpense(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: UpdateSharedExpenseDto,
    ): Promise<ApprovalResponseDto> {
        return this.sharedExpenseService.proposeUpdateSharedExpense(userId, expenseId, dto);
    }

    @ProposeDeleteSharedExpenseEndpoint()
    async proposeDeleteSharedExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<ApprovalResponseDto> {
        return this.sharedExpenseService.proposeDeleteSharedExpense(userId, expenseId);
    }

    @ProposeSkipSharedExpenseEndpoint()
    async proposeSkipSharedExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string, @Body() dto: SkipExpenseDto): Promise<ApprovalResponseDto> {
        return this.sharedExpenseService.proposeSkipExpense(userId, expenseId, dto);
    }

    @ProposeUnskipSharedExpenseEndpoint()
    async proposeUnskipSharedExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string, @Body() dto: SkipExpenseDto): Promise<ApprovalResponseDto> {
        return this.sharedExpenseService.proposeUnskipExpense(userId, expenseId, dto);
    }
}
