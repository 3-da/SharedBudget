import { Body, Controller, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpensePaymentService } from './expense-payment.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ExpensePaymentResponseDto } from './dto/expense-payment-response.dto';
import { DashboardQueryDto } from '../dashboard/dto/dashboard-query.dto';
import { resolveMonthYear } from '../common/utils/resolve-month-year';
import {
    MarkPaidEndpoint,
    UndoPaidEndpoint,
    CancelExpenseEndpoint,
    GetPaymentStatusEndpoint,
    GetBatchPaymentStatusEndpoint,
} from './decorators/api-expense-payment.decorators';

@ApiTags('Expense Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensePaymentController {
    constructor(private readonly expensePaymentService: ExpensePaymentService) {}

    @GetBatchPaymentStatusEndpoint()
    async getBatchPaymentStatus(@CurrentUser('id') userId: string, @Query() query: DashboardQueryDto): Promise<ExpensePaymentResponseDto[]> {
        const { month, year } = resolveMonthYear(query.month, query.year);
        return this.expensePaymentService.getBatchPaymentStatuses(userId, month, year);
    }

    @MarkPaidEndpoint()
    async markPaid(@CurrentUser('id') userId: string, @Param('id') expenseId: string, @Body() dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        return this.expensePaymentService.markPaid(userId, expenseId, dto);
    }

    @UndoPaidEndpoint()
    async undoPaid(@CurrentUser('id') userId: string, @Param('id') expenseId: string, @Body() dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        return this.expensePaymentService.undoPaid(userId, expenseId, dto);
    }

    @CancelExpenseEndpoint()
    async cancelExpense(@CurrentUser('id') userId: string, @Param('id') expenseId: string, @Body() dto: MarkPaidDto): Promise<ExpensePaymentResponseDto> {
        return this.expensePaymentService.cancel(userId, expenseId, dto);
    }

    @GetPaymentStatusEndpoint()
    async getPaymentStatus(@CurrentUser('id') userId: string, @Param('id') expenseId: string): Promise<ExpensePaymentResponseDto[]> {
        return this.expensePaymentService.getPaymentStatuses(userId, expenseId);
    }
}
