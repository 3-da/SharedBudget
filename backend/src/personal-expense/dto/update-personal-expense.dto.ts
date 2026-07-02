import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../generated/prisma/enums';
import { IsCurrencyAmount } from '../../common/decorators/is-currency-amount.decorator';

export class UpdatePersonalExpenseDto {
    @ApiPropertyOptional({ example: 'Gym membership', minLength: 1, maxLength: 100 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string;

    @IsCurrencyAmount({ example: 49.99, min: 0, optional: true })
    amount?: number;

    @ApiPropertyOptional({ enum: ExpenseCategory })
    @IsOptional()
    @IsEnum(ExpenseCategory)
    category?: ExpenseCategory;

    @ApiPropertyOptional({ enum: ExpenseFrequency })
    @IsOptional()
    @IsEnum(ExpenseFrequency)
    frequency?: ExpenseFrequency;

    @ApiPropertyOptional({ enum: YearlyPaymentStrategy })
    @IsOptional()
    @IsEnum(YearlyPaymentStrategy)
    yearlyPaymentStrategy?: YearlyPaymentStrategy | null;

    @ApiPropertyOptional({ enum: InstallmentFrequency })
    @IsOptional()
    @IsEnum(InstallmentFrequency)
    installmentFrequency?: InstallmentFrequency | null;

    @ApiPropertyOptional({ example: 24, description: 'Total number of installments', minimum: 1 })
    @IsOptional()
    @IsInt()
    @Min(1)
    installmentCount?: number | null;

    @ApiPropertyOptional({ example: 6, minimum: 1, maximum: 12 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    paymentMonth?: number | null;

    @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 12 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number | null;

    @ApiPropertyOptional({ example: 2026 })
    @IsOptional()
    @IsInt()
    @Min(2000)
    year?: number | null;

    @ApiPropertyOptional({
        example: true,
        description: 'Whether the expense has a fixed amount (true) or is a flexible budget (false).',
    })
    @IsOptional()
    @IsBoolean()
    isFixed?: boolean;
}
