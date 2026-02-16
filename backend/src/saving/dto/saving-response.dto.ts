import { ApiProperty } from '@nestjs/swagger';

export class SavingResponseDto {
    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
    id!: string;

    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
    userId!: string;

    @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440000' })
    householdId!: string;

    @ApiProperty({ example: 200.0 })
    amount!: number;

    @ApiProperty({ example: 6 })
    month!: number;

    @ApiProperty({ example: 2026 })
    year!: number;

    @ApiProperty({ example: false })
    isShared!: boolean;

    @ApiProperty()
    createdAt!: Date;

    @ApiProperty()
    updatedAt!: Date;
}
