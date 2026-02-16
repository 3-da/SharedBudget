import { ApiProperty } from '@nestjs/swagger';

export class MemberExpenseSummaryDto {
    @ApiProperty({ type: 'string', description: 'User ID' })
    userId!: string;

    @ApiProperty({ example: 'John' })
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    lastName!: string;

    @ApiProperty({ example: 349.99, type: 'number', description: 'Total personal expenses (monthly equivalent)' })
    personalExpensesTotal!: number;

    @ApiProperty({ example: 149.99, type: 'number', description: 'Remaining unpaid personal expenses this month' })
    remainingExpenses!: number;
}

export class ExpenseSummaryDto {
    @ApiProperty({ type: [MemberExpenseSummaryDto], description: 'Personal expense totals per member' })
    personalExpenses!: MemberExpenseSummaryDto[];

    @ApiProperty({ example: 1200.0, type: 'number', description: 'Total shared expenses (monthly equivalent)' })
    sharedExpensesTotal!: number;

    @ApiProperty({ example: 1899.98, type: 'number', description: 'Total household expenses (personal + shared) for this month' })
    totalHouseholdExpenses!: number;

    @ApiProperty({ example: 899.98, type: 'number', description: 'Remaining unpaid household expenses this month (total - paid)' })
    remainingHouseholdExpenses!: number;
}
