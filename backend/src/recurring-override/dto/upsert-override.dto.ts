import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsBoolean } from 'class-validator';

export class UpsertOverrideDto {
    @ApiProperty({ example: 450.0, description: 'Overridden amount for this month', minimum: 0 })
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiPropertyOptional({ example: false, description: 'If true, expense is skipped this month' })
    @IsOptional()
    @IsBoolean()
    skipped?: boolean;
}
