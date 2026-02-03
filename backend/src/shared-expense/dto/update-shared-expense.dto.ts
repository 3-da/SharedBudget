import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ExpenseCategory, ExpenseFrequency, InstallmentFrequency, YearlyPaymentStrategy } from '../../generated/prisma/enums';

export class UpdateSharedExpenseDto {
    @ApiPropertyOptional({ example: 'Monthly Rent', minLength: 1, maxLength: 100 })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: 500.0, minimum: 0 })
    @IsOptional()
    @IsNumber()
    @Min(0)
    amount?: number;

    @ApiPropertyOptional({ enum: ExpenseCategory })
    @IsOptional()
    @IsEnum(ExpenseCategory)
    category?: ExpenseCategory;

    @ApiPropertyOptional({ enum: ExpenseFrequency })
    @IsOptional()
    @IsEnum(ExpenseFrequency)
    frequency?: ExpenseFrequency;

    @ApiPropertyOptional({ description: 'User ID of the payer. Null means split equally.' })
    @IsOptional()
    @IsUUID()
    paidByUserId?: string | null;

    @ApiPropertyOptional({ enum: YearlyPaymentStrategy })
    @IsOptional()
    @IsEnum(YearlyPaymentStrategy)
    yearlyPaymentStrategy?: YearlyPaymentStrategy | null;

    @ApiPropertyOptional({ enum: InstallmentFrequency })
    @IsOptional()
    @IsEnum(InstallmentFrequency)
    installmentFrequency?: InstallmentFrequency | null;

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
}
