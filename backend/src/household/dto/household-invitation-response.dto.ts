import { ApiProperty } from '@nestjs/swagger';
import { InvitationStatus } from '../../generated/prisma/enums';

export class HouseholdInvitationResponseDto {
    @ApiProperty({ type: 'string' })
    id!: string;

    @ApiProperty({ enum: InvitationStatus, enumName: 'InvitationStatus' })
    status!: InvitationStatus;

    @ApiProperty({ type: 'string' })
    householdId!: string;

    @ApiProperty({ example: 'My Home' })
    householdName!: string;

    @ApiProperty({ type: 'string' })
    senderId!: string;

    @ApiProperty({ example: 'John' })
    senderFirstName!: string;

    @ApiProperty({ example: 'Doe' })
    senderLastName!: string;

    @ApiProperty({ type: 'string' })
    targetUserId!: string;

    @ApiProperty({ example: 'Jane' })
    targetFirstName!: string;

    @ApiProperty({ example: 'Doe' })
    targetLastName!: string;

    @ApiProperty({ type: 'string', format: 'date-time' })
    createdAt!: Date;

    @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
    respondedAt!: Date | null;
}
