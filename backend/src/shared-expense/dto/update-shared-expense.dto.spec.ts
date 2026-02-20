import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateSharedExpenseDto } from './update-shared-expense.dto';

describe('UpdateSharedExpenseDto', () => {
    it('should accept an empty update (no fields)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, {});
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a valid partial update (name only)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { name: 'Updated Rent' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a valid partial update (amount only)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { amount: 850 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept a valid paidByUserId', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, {
            paidByUserId: '550e8400-e29b-41d4-a716-446655440000',
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    //#region name validation
    it('should reject name shorter than 1 character', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { name: '' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should accept name at minimum length (1 char)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { name: 'A' });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept name at maximum length (100 chars)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { name: 'A'.repeat(100) });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject name exceeding 100 characters', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { name: 'A'.repeat(101) });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('maxLength');
    });
    //#endregion

    //#region amount validation
    it('should accept amount of 0', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { amount: 0 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject negative amount', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { amount: -1 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('min');
    });
    //#endregion

    //#region enum validation
    it('should reject invalid category', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { category: 'INVALID' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should reject invalid frequency', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { frequency: 'WEEKLY' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should reject invalid yearlyPaymentStrategy', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { yearlyPaymentStrategy: 'INVALID' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isEnum');
    });
    //#endregion

    //#region paidByUserId validation
    it('should reject invalid UUID for paidByUserId', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { paidByUserId: 'not-a-uuid' });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].constraints).toHaveProperty('isUuid');
    });
    //#endregion

    //#region boundary values
    it('should reject paymentMonth below 1', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { paymentMonth: 0 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept paymentMonth at boundary (1)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { paymentMonth: 1 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should accept paymentMonth at boundary (12)', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { paymentMonth: 12 });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
    });

    it('should reject paymentMonth above 12', async () => {
        const dto = plainToInstance(UpdateSharedExpenseDto, { paymentMonth: 13 });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
    });
    //#endregion
});
