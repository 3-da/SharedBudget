import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class UpsertSalaryDto {
    @ApiProperty({
        example: 3500.0,
        description: 'Baseline monthly salary amount',
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    defaultAmount!: number;

    @ApiProperty({
        example: 3500.0,
        description: 'Actual salary for this month (may differ from default)',
    })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    currentAmount!: number;
}
