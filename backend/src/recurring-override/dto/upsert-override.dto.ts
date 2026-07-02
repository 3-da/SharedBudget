import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { IsCurrencyAmount } from '../../common/decorators/is-currency-amount.decorator';

export class UpsertOverrideDto {
    @IsCurrencyAmount({ example: 450.0, description: 'Overridden amount for this month', min: 0 })
    amount!: number;

    @ApiPropertyOptional({ example: false, description: 'If true, expense is skipped this month' })
    @IsOptional()
    @IsBoolean()
    skipped?: boolean;
}
