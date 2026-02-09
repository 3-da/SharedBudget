import { Body, Controller, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExpensePaymentService } from './expense-payment.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ExpensePaymentResponseDto } from './dto/expense-payment-response.dto';
import {
    MarkPaidEndpoint,
    UndoPaidEndpoint,
    CancelExpenseEndpoint,
    GetPaymentStatusEndpoint,
} from './decorators/api-expense-payment.decorators';

@ApiTags('Expense Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensePaymentController {
    constructor(private readonly expensePaymentService: ExpensePaymentService) {}

    @MarkPaidEndpoint()
    async markPaid(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: MarkPaidDto,
    ): Promise<ExpensePaymentResponseDto> {
        return this.expensePaymentService.markPaid(userId, expenseId, dto);
    }

    @UndoPaidEndpoint()
    async undoPaid(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: MarkPaidDto,
    ): Promise<ExpensePaymentResponseDto> {
        return this.expensePaymentService.undoPaid(userId, expenseId, dto);
    }

    @CancelExpenseEndpoint()
    async cancelExpense(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
        @Body() dto: MarkPaidDto,
    ): Promise<ExpensePaymentResponseDto> {
        return this.expensePaymentService.cancel(userId, expenseId, dto);
    }

    @GetPaymentStatusEndpoint()
    async getPaymentStatus(
        @CurrentUser('id') userId: string,
        @Param('id') expenseId: string,
    ): Promise<ExpensePaymentResponseDto[]> {
        return this.expensePaymentService.getPaymentStatuses(userId, expenseId);
    }
}
