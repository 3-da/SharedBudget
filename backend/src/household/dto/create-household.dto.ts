import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateHouseholdDto {
    @ApiProperty({
        example: 'My Home',
        description: 'Name of the household',
        minLength: 1,
        maxLength: 50,
    })
    @IsNotEmpty()
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    name: string;
}
