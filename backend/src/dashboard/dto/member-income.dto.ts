import { ApiProperty } from '@nestjs/swagger';

export class MemberIncomeDto {
    @ApiProperty({ type: 'string', description: 'User ID' })
    userId: string;

    @ApiProperty({ example: 'John', description: "Member's first name" })
    firstName: string;

    @ApiProperty({ example: 'Doe', description: "Member's last name" })
    lastName: string;

    @ApiProperty({ example: 3500.0, type: 'number', description: 'Default (baseline) monthly salary' })
    defaultSalary: number;

    @ApiProperty({ example: 3200.0, type: 'number', description: 'Current month salary' })
    currentSalary: number;
}
