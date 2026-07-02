import { IsNotEmpty } from 'class-validator';
import { IsCurrencyAmount } from '../../common/decorators/is-currency-amount.decorator';

export class UpsertSalaryDto {
    @IsNotEmpty()
    @IsCurrencyAmount({ example: 3500.0, description: 'Baseline monthly salary amount', min: 0 })
    defaultAmount!: number;

    @IsNotEmpty()
    @IsCurrencyAmount({ example: 3500.0, description: 'Actual salary for this month (may differ from default)', min: 0 })
    currentAmount!: number;
}
