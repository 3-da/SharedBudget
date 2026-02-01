import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
    @ApiProperty({ example: 409, description: 'HTTP status code' })
    statusCode: number;

    @ApiProperty({
        example: 'User already belongs to a household',
        description: 'Error message (string for single errors, array for validation errors)',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    })
    message: string | string[];

    @ApiProperty({ example: 'Conflict', description: 'HTTP error name' })
    error: string;

    @ApiProperty({ example: '2026-02-01T12:00:00.000Z', description: 'ISO 8601 timestamp' })
    timestamp: string;

    @ApiProperty({ example: 'abc-123-def', description: 'Unique request identifier for tracing' })
    requestId: string;
}
