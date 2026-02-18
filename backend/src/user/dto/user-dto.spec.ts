import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChangePasswordDto } from './change-password.dto';
import { UpdateProfileDto } from './update-profile.dto';

describe('ChangePasswordDto', () => {
    const validData = { currentPassword: 'OldPass123!', newPassword: 'NewSecure456!' };

    it('should accept valid change password data', async () => {
        const dto = plainToInstance(ChangePasswordDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('currentPassword', () => {
        it('should accept password at minimum length (boundary: 8 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, currentPassword: '12345678' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password below minimum length (boundary: 7 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, currentPassword: '1234567' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('currentPassword');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept password at maximum length (boundary: 72 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, currentPassword: 'a'.repeat(72) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password above maximum length (boundary: 73 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, currentPassword: 'a'.repeat(73) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('currentPassword');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });

        it('should reject non-string currentPassword', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, currentPassword: 12345678 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('currentPassword');
        });
    });

    describe('newPassword', () => {
        it('should accept password at minimum length (boundary: 8 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, newPassword: 'Abcdef1x' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password below minimum length (boundary: 7 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, newPassword: 'Abcde1x' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept password at maximum length (boundary: 72 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, newPassword: 'Aa1' + 'x'.repeat(69) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password above maximum length (boundary: 73 chars)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, newPassword: 'Aa1' + 'x'.repeat(70) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });

        it('should reject non-string newPassword', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, newPassword: 12345678 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
        });

        it('should reject password without complexity (lowercase only)', async () => {
            const dto = plainToInstance(ChangePasswordDto, { ...validData, newPassword: 'abcdefgh' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
            expect(errors[0].constraints).toHaveProperty('matches');
        });
    });

    it('should reject empty object with errors for all fields', async () => {
        const dto = plainToInstance(ChangePasswordDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(2);
        expect(errors.map((e) => e.property).sort()).toEqual(['currentPassword', 'newPassword']);
    });
});

describe('UpdateProfileDto', () => {
    const validData = { firstName: 'John', lastName: 'Doe' };

    it('should accept valid profile data', async () => {
        const dto = plainToInstance(UpdateProfileDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('firstName', () => {
        it('should accept firstName at minimum length (boundary: 1 char)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, firstName: 'A' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject empty firstName (boundary: 0 chars)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, firstName: '' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('firstName');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept firstName at maximum length (boundary: 50 chars)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, firstName: 'A'.repeat(50) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject firstName above maximum length (boundary: 51 chars)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, firstName: 'A'.repeat(51) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('firstName');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });

        it('should reject non-string firstName', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, firstName: 123 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('firstName');
        });
    });

    describe('lastName', () => {
        it('should accept lastName at minimum length (boundary: 1 char)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, lastName: 'D' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject empty lastName (boundary: 0 chars)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, lastName: '' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('lastName');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept lastName at maximum length (boundary: 50 chars)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, lastName: 'D'.repeat(50) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject lastName above maximum length (boundary: 51 chars)', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, lastName: 'D'.repeat(51) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('lastName');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });

        it('should reject non-string lastName', async () => {
            const dto = plainToInstance(UpdateProfileDto, { ...validData, lastName: 456 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('lastName');
        });
    });

    it('should reject empty object with errors for all fields', async () => {
        const dto = plainToInstance(UpdateProfileDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(2);
        expect(errors.map((e) => e.property).sort()).toEqual(['firstName', 'lastName']);
    });
});
