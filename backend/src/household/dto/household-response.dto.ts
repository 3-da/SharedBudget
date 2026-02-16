import { ApiProperty } from '@nestjs/swagger';
import { HouseholdRole } from '../../generated/prisma/enums';

class HouseholdMemberResponseDto {
    @ApiProperty({ type: 'string' })
    id!: string;

    @ApiProperty({ type: 'string' })
    userId!: string;

    @ApiProperty({ example: 'John' })
    firstName!: string;

    @ApiProperty({ example: 'Doe' })
    lastName!: string;

    @ApiProperty({ enum: HouseholdRole, enumName: 'HouseholdRole' })
    role!: HouseholdRole;

    @ApiProperty({ type: 'string', format: 'date-time' })
    joinedAt!: Date;
}

export class HouseholdResponseDto {
    @ApiProperty({ type: 'string' })
    id!: string;

    @ApiProperty({ example: 'My Home', minLength: 1, maxLength: 50 })
    name!: string;

    @ApiProperty({ example: 'a1b2c3d4' })
    inviteCode!: string;

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt!: Date;

    @ApiProperty({ example: 2, type: 'integer', format: 'int32' })
    maxMembers!: number;

    @ApiProperty({ type: [HouseholdMemberResponseDto] })
    members!: HouseholdMemberResponseDto[];
}
