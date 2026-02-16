import { ApiProperty } from '@nestjs/swagger';
import { MemberIncomeDto } from './member-income.dto';
import { ExpenseSummaryDto } from './expense-summary.dto';
import { SavingsResponseDto } from './member-savings.dto';
import { SettlementResponseDto } from './settlement-response.dto';

export class DashboardResponseDto {
    @ApiProperty({ type: [MemberIncomeDto], description: 'Income details per member' })
    income!: MemberIncomeDto[];

    @ApiProperty({ example: 7000.0, type: 'number', description: 'Total household income (sum of default salaries)' })
    totalDefaultIncome!: number;

    @ApiProperty({ example: 6700.0, type: 'number', description: 'Total household income (sum of current salaries)' })
    totalCurrentIncome!: number;

    @ApiProperty({ type: ExpenseSummaryDto, description: 'Expense breakdown' })
    expenses!: ExpenseSummaryDto;

    @ApiProperty({ type: SavingsResponseDto, description: 'Savings breakdown per member and total' })
    savings!: SavingsResponseDto;

    @ApiProperty({ type: SettlementResponseDto, description: 'Current settlement calculation' })
    settlement!: SettlementResponseDto;

    @ApiProperty({ example: 3, type: 'number', description: 'Number of pending approvals requiring attention' })
    pendingApprovalsCount!: number;

    @ApiProperty({ example: 2, minimum: 1, maximum: 12 })
    month!: number;

    @ApiProperty({ example: 2026 })
    year!: number;
}
