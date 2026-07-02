import { IsCurrencyAmount } from '../../common/decorators/is-currency-amount.decorator';

export class UpdateDefaultAmountDto {
    @IsCurrencyAmount({ example: 500.0, description: 'New default amount for the expense', min: 1 })
    amount!: number;
}
