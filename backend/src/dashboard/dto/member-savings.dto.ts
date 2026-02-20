import { ApiProperty } from '@nestjs/swagger';

export class MemberSavingsDto {
    @ApiProperty({ type: 'string', description: 'User ID' })
    userId!: string;

    @ApiProperty({ example: 'John' })
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    lastName!: string;

    @ApiProperty({ example: 500.0, type: 'number', description: 'Personal savings from Saving records (isShared=false)' })
    personalSavings!: number;

    @ApiProperty({ example: 200.0, type: 'number', description: 'Shared savings from Saving records (isShared=true)' })
    sharedSavings!: number;

    @ApiProperty({
        example: 1850.01,
        type: 'number',
        description: 'Remaining budget = salary - personal expenses - shared expense share - personal savings - shared savings',
    })
    remainingBudget!: number;
}

export class SavingsResponseDto {
    @ApiProperty({ type: [MemberSavingsDto], description: 'Savings breakdown per member' })
    members!: MemberSavingsDto[];

    @ApiProperty({ example: 1000.0, type: 'number', description: 'Combined personal savings from all members (from Saving records)' })
    totalPersonalSavings!: number;

    @ApiProperty({ example: 400.0, type: 'number', description: 'Combined shared savings from all members (from Saving records)' })
    totalSharedSavings!: number;

    @ApiProperty({ example: 1400.0, type: 'number', description: 'Total savings = totalPersonalSavings + totalSharedSavings' })
    totalSavings!: number;

    @ApiProperty({ example: 3600.02, type: 'number', description: 'Combined remaining budget across all members' })
    totalRemainingBudget!: number;
}
