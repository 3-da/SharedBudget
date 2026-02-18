import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DashboardQueryDto {
    @ApiPropertyOptional({ example: 'monthly', description: 'Dashboard mode', enum: ['monthly', 'yearly'] })
    @IsOptional()
    @IsString()
    @IsIn(['monthly', 'yearly'])
    mode?: string;

    @ApiPropertyOptional({ example: 2, description: 'Month (1-12)', minimum: 1, maximum: 12 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ example: 2026, description: 'Year', minimum: 2000 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(2000)
    year?: number;
}
