import { ApiProperty } from '@nestjs/swagger';

export class PendingDeleteRequestResponseDto {
    @ApiProperty({ example: 'abc123', description: 'Unique request ID' })
    requestId: string;

    @ApiProperty({ example: '123e4567-...', description: 'ID of the owner requesting account deletion' })
    ownerId: string;

    @ApiProperty({ example: 'Alex', description: 'First name of the owner' })
    ownerFirstName: string;

    @ApiProperty({ example: 'Smith', description: 'Last name of the owner' })
    ownerLastName: string;

    @ApiProperty({ example: 'My Household', description: 'Name of the household' })
    householdName: string;

    @ApiProperty({ example: '2026-02-20T12:00:00.000Z', description: 'When the request was created' })
    requestedAt: string;
}
