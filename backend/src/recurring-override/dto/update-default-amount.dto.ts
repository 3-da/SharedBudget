import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdateDefaultAmountDto {
    @ApiProperty({ example: 500.0, description: 'New default amount for the expense', minimum: 1 })
    @IsNumber()
    @Min(1)
    amount!: number;
}
