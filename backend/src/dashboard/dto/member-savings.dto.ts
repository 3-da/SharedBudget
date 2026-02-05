import { ApiProperty } from '@nestjs/swagger';

export class MemberSavingsDto {
    @ApiProperty({ type: 'string', description: 'User ID' })
    userId: string;

    @ApiProperty({ example: 'John' })
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    lastName: string;

    @ApiProperty({ example: 2550.01, type: 'number', description: 'Default savings = default salary - personal expenses - share of shared expenses' })
    defaultSavings: number;

    @ApiProperty({ example: 2250.01, type: 'number', description: 'Current savings = current salary - personal expenses - share of shared expenses' })
    currentSavings: number;
}

export class SavingsResponseDto {
    @ApiProperty({ type: [MemberSavingsDto], description: 'Savings breakdown per member' })
    members: MemberSavingsDto[];

    @ApiProperty({ example: 4500.02, type: 'number', description: 'Combined household savings (sum of all member default savings)' })
    totalDefaultSavings: number;

    @ApiProperty({ example: 4000.02, type: 'number', description: 'Combined household savings (sum of all member current savings)' })
    totalCurrentSavings: number;
}
