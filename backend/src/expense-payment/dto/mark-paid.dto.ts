import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';
import { IsCurrencyAmount } from '../../common/decorators/is-currency-amount.decorator';

export class MarkPaidDto {
    @ApiProperty({ example: 6, description: 'Month (1-12)', minimum: 1, maximum: 12 })
    @IsInt()
    @Min(1)
    @Max(12)
    month!: number;

    @ApiProperty({ example: 2026, description: 'Year', minimum: 2020, maximum: 2099 })
    @IsInt()
    @Min(2020)
    @Max(2099)
    year!: number;

    @IsCurrencyAmount({
        example: 45.5,
        description: 'Actual amount paid. Required for flexible expenses (isFixed=false), ignored for fixed expenses.',
        min: 0.01,
        optional: true,
    })
    paidAmount?: number;
}
