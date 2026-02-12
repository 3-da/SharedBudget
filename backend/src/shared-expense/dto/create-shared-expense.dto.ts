import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../generated/prisma/enums';

export class CreateSharedExpenseDto {
    @ApiProperty({ example: 'Monthly Rent', description: 'Expense name', minLength: 1, maxLength: 100 })
    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: 500.0, description: 'Amount in EUR', minimum: 1 })
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiProperty({ enum: ExpenseCategory, example: 'RECURRING', description: 'RECURRING or ONE_TIME' })
    @IsEnum(ExpenseCategory)
    category: ExpenseCategory;

    @ApiProperty({ enum: ExpenseFrequency, example: 'MONTHLY', description: 'MONTHLY or YEARLY' })
    @IsEnum(ExpenseFrequency)
    frequency: ExpenseFrequency;

    @ApiPropertyOptional({ description: 'User ID of the person who pays. Null means split equally among members.' })
    @IsOptional()
    @IsUUID()
    paidByUserId?: string;

    //#region Yearly specific fields
    @ApiPropertyOptional({ enum: YearlyPaymentStrategy, description: 'Required if frequency is YEARLY' })
    @ValidateIf((o) => o.frequency === ExpenseFrequency.YEARLY)
    @IsEnum(YearlyPaymentStrategy)
    yearlyPaymentStrategy?: YearlyPaymentStrategy;

    @ApiPropertyOptional({ enum: InstallmentFrequency, description: 'Required if strategy is INSTALLMENTS' })
    @ValidateIf((o) => o.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS)
    @IsEnum(InstallmentFrequency)
    installmentFrequency?: InstallmentFrequency;

    @ApiPropertyOptional({ example: 24, description: 'Total number of installments. Required if strategy is INSTALLMENTS', minimum: 1 })
    @ValidateIf((o) => o.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS)
    @IsInt()
    @Min(1)
    installmentCount?: number;

    @ApiPropertyOptional({ example: 6, description: 'Month to pay in full (1-12). Required if strategy is FULL', minimum: 1, maximum: 12 })
    @ValidateIf((o) => o.yearlyPaymentStrategy === YearlyPaymentStrategy.FULL && o.category !== ExpenseCategory.ONE_TIME)
    @IsInt()
    @Min(1)
    @Max(12)
    paymentMonth?: number;
    //#endregion

    //#region One time specific fields
    @ApiPropertyOptional({ example: 3, description: 'Month (1-12). Required if category is ONE_TIME', minimum: 1, maximum: 12 })
    @ValidateIf((o) => o.category === ExpenseCategory.ONE_TIME)
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ example: 2026, description: 'Year. Required if category is ONE_TIME' })
    @ValidateIf((o) => o.category === ExpenseCategory.ONE_TIME)
    @IsInt()
    @Min(2000)
    year?: number;
    //#endregion
}
