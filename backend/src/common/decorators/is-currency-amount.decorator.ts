import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

interface CurrencyAmountOptions {
    example: number;
    description?: string;
    min?: number;
    optional?: boolean;
}

/**
 * Composite decorator for a money field: validates it's a number with at most
 * 2 decimal places (no sub-cent amounts) and documents it in Swagger. Every
 * money field in the app should use this instead of a bare @IsNumber() so the
 * sub-cent rule can't be forgotten on a new field.
 */
export function IsCurrencyAmount(options: CurrencyAmountOptions): PropertyDecorator {
    const { example, description, min = 0, optional = false } = options;
    const apiDecorator = optional ? ApiPropertyOptional({ example, description, minimum: min }) : ApiProperty({ example, description, minimum: min });

    const decorators = [apiDecorator, IsNumber({ maxDecimalPlaces: 2 }), Min(min)];
    if (optional) decorators.push(IsOptional());

    return applyDecorators(...decorators);
}
