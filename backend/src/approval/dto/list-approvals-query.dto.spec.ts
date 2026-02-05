import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListApprovalsQueryDto } from './list-approvals-query.dto';
import { ApprovalStatus } from '../../generated/prisma/enums';

describe('ListApprovalsQueryDto', () => {
    it('should accept when no status filter is provided', async () => {
        const dto = plainToInstance(ListApprovalsQueryDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept ACCEPTED status filter', async () => {
        const dto = plainToInstance(ListApprovalsQueryDto, { status: ApprovalStatus.ACCEPTED });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept REJECTED status filter', async () => {
        const dto = plainToInstance(ListApprovalsQueryDto, { status: ApprovalStatus.REJECTED });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject invalid status value', async () => {
        const dto = plainToInstance(ListApprovalsQueryDto, { status: 'INVALID' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });
});
