import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AcceptApprovalDto } from './accept-approval.dto';

describe('AcceptApprovalDto', () => {
    it('should accept when no message is provided', async () => {
        const dto = plainToInstance(AcceptApprovalDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a valid message', async () => {
        const dto = plainToInstance(AcceptApprovalDto, { message: 'Looks good!' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept message at maximum length (500 chars)', async () => {
        const dto = plainToInstance(AcceptApprovalDto, { message: 'A'.repeat(500) });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject message exceeding maximum length (501 chars)', async () => {
        const dto = plainToInstance(AcceptApprovalDto, { message: 'A'.repeat(501) });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should reject when message is not a string', async () => {
        const dto = plainToInstance(AcceptApprovalDto, { message: 123 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should accept an empty string message', async () => {
        const dto = plainToInstance(AcceptApprovalDto, { message: '' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept message at minimum length (1 char)', async () => {
        const dto = plainToInstance(AcceptApprovalDto, { message: 'A' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });
});
