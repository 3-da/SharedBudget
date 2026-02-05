import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RejectApprovalDto } from './reject-approval.dto';

describe('RejectApprovalDto', () => {
    it('should accept a valid rejection message', async () => {
        const dto = plainToInstance(RejectApprovalDto, { message: 'Amount is too high' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept message at maximum length (500 chars)', async () => {
        const dto = plainToInstance(RejectApprovalDto, { message: 'A'.repeat(500) });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject message exceeding maximum length (501 chars)', async () => {
        const dto = plainToInstance(RejectApprovalDto, { message: 'A'.repeat(501) });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should reject when message is empty', async () => {
        const dto = plainToInstance(RejectApprovalDto, { message: '' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should reject when message is missing', async () => {
        const dto = plainToInstance(RejectApprovalDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject when message is not a string', async () => {
        const dto = plainToInstance(RejectApprovalDto, { message: 123 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should accept message at minimum length (1 char)', async () => {
        const dto = plainToInstance(RejectApprovalDto, { message: 'A' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });
});
