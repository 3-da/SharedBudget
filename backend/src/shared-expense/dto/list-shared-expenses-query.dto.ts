import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ExpenseCategory, ExpenseFrequency } from '../../generated/prisma/enums';

export class ListSharedExpensesQueryDto {
    @ApiPropertyOptional({ enum: ExpenseCategory, description: 'Filter by category' })
    @IsOptional()
    @IsEnum(ExpenseCategory)
    category?: ExpenseCategory;

    @ApiPropertyOptional({ enum: ExpenseFrequency, description: 'Filter by frequency' })
    @IsOptional()
    @IsEnum(ExpenseFrequency)
    frequency?: ExpenseFrequency;
}
