import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
    @ApiProperty({ example: 'John', description: 'First name', minLength: 1, maxLength: 50 })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    firstName: string;

    @ApiProperty({ example: 'John', description: 'First name', minLength: 1, maxLength: 50 })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    lastName: string;
}
