import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';
import { LoginDto } from './login.dto';
import { VerifyCodeDto } from './verify-code.dto';
import { ResendCodeDto } from './resend-code.dto';
import { RefreshDto } from './refresh.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResetPasswordDto } from './reset-password.dto';

describe('RegisterDto', () => {
    const validData = { email: 'user@example.com', password: 'SecurePass1', firstName: 'John', lastName: 'Doe' };

    it('should accept valid registration data', async () => {
        const dto = plainToInstance(RegisterDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('email', () => {
        it('should reject invalid email format', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, email: 'not-an-email' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('email');
            expect(errors[0].constraints).toHaveProperty('isEmail');
        });

        it('should reject empty email', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, email: '' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('email');
        });
    });

    describe('password', () => {
        it('should accept password at minimum length (boundary: 8 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 'Abcdef1x' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password below minimum length (boundary: 7 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 'Abcde1x' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept password at maximum length (boundary: 72 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 'Aa1' + 'x'.repeat(69) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password above maximum length (boundary: 73 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 'Aa1' + 'x'.repeat(70) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });

        it('should reject non-string password', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 12345678 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
        });

        it('should reject password with only lowercase letters', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 'abcdefgh' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
            expect(errors[0].constraints).toHaveProperty('matches');
        });

        it('should reject password with only digits', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: '12345678' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
            expect(errors[0].constraints).toHaveProperty('matches');
        });

        it('should reject password without digits', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, password: 'Abcdefgh' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('password');
            expect(errors[0].constraints).toHaveProperty('matches');
        });
    });

    describe('firstName', () => {
        it('should accept firstName at minimum length (boundary: 1 char)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, firstName: 'A' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject empty firstName (boundary: 0 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, firstName: '' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('firstName');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept firstName at maximum length (boundary: 50 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, firstName: 'A'.repeat(50) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject firstName above maximum length (boundary: 51 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, firstName: 'A'.repeat(51) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('firstName');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });
    });

    describe('lastName', () => {
        it('should accept lastName at minimum length (boundary: 1 char)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, lastName: 'D' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject empty lastName (boundary: 0 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, lastName: '' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('lastName');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept lastName at maximum length (boundary: 50 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, lastName: 'D'.repeat(50) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject lastName above maximum length (boundary: 51 chars)', async () => {
            const dto = plainToInstance(RegisterDto, { ...validData, lastName: 'D'.repeat(51) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('lastName');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });
    });

    it('should reject empty object with errors for all fields', async () => {
        const dto = plainToInstance(RegisterDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(4);
        expect(errors.map((e) => e.property).sort()).toEqual(['email', 'firstName', 'lastName', 'password']);
    });
});

describe('LoginDto', () => {
    const validData = { email: 'user@example.com', password: 'SecurePass1' };

    it('should accept valid login data', async () => {
        const dto = plainToInstance(LoginDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject invalid email', async () => {
        const dto = plainToInstance(LoginDto, { ...validData, email: 'bad-email' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('email');
        expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should reject non-string password', async () => {
        const dto = plainToInstance(LoginDto, { ...validData, password: 123 });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('password');
    });

    it('should reject empty object', async () => {
        const dto = plainToInstance(LoginDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(2);
        expect(errors.map((e) => e.property).sort()).toEqual(['email', 'password']);
    });
});

describe('VerifyCodeDto', () => {
    const validData = { email: 'user@example.com', code: '123456' };

    it('should accept valid verification data', async () => {
        const dto = plainToInstance(VerifyCodeDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject invalid email', async () => {
        const dto = plainToInstance(VerifyCodeDto, { ...validData, email: 'not-email' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('email');
    });

    it('should accept code at exact length (boundary: 6 chars)', async () => {
        const dto = plainToInstance(VerifyCodeDto, { ...validData, code: '000000' });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject code that is too short (boundary: 5 chars)', async () => {
        const dto = plainToInstance(VerifyCodeDto, { ...validData, code: '12345' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('code');
        expect(errors[0].constraints).toHaveProperty('isLength');
    });

    it('should reject code that is too long (boundary: 7 chars)', async () => {
        const dto = plainToInstance(VerifyCodeDto, { ...validData, code: '1234567' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('code');
        expect(errors[0].constraints).toHaveProperty('isLength');
    });

    it('should reject empty object', async () => {
        const dto = plainToInstance(VerifyCodeDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(2);
        expect(errors.map((e) => e.property).sort()).toEqual(['code', 'email']);
    });
});

describe('ResendCodeDto', () => {
    it('should accept valid email', async () => {
        const dto = plainToInstance(ResendCodeDto, { email: 'user@example.com' });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject invalid email', async () => {
        const dto = plainToInstance(ResendCodeDto, { email: 'bad' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('email');
        expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should reject missing email', async () => {
        const dto = plainToInstance(ResendCodeDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('email');
    });
});

describe('RefreshDto', () => {
    it('should accept valid refresh token', async () => {
        const dto = plainToInstance(RefreshDto, { refreshToken: 'some-valid-token-string' });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject empty refresh token', async () => {
        const dto = plainToInstance(RefreshDto, { refreshToken: '' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('refreshToken');
        expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should reject non-string refresh token', async () => {
        const dto = plainToInstance(RefreshDto, { refreshToken: 12345 });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('refreshToken');
    });

    it('should reject missing refresh token', async () => {
        const dto = plainToInstance(RefreshDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('refreshToken');
    });
});

describe('ForgotPasswordDto', () => {
    it('should accept valid email', async () => {
        const dto = plainToInstance(ForgotPasswordDto, { email: 'user@example.com' });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject invalid email', async () => {
        const dto = plainToInstance(ForgotPasswordDto, { email: 'not-email' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('email');
        expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should reject missing email', async () => {
        const dto = plainToInstance(ForgotPasswordDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('email');
    });
});

describe('ResetPasswordDto', () => {
    const validData = { token: 'valid-reset-token', newPassword: 'NewSecure1' };

    it('should accept valid reset data', async () => {
        const dto = plainToInstance(ResetPasswordDto, validData);
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    describe('token', () => {
        it('should reject empty token', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, token: '' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('token');
            expect(errors[0].constraints).toHaveProperty('isNotEmpty');
        });

        it('should reject non-string token', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, token: 123 });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('token');
        });
    });

    describe('newPassword', () => {
        it('should accept password at minimum length (boundary: 8 chars)', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, newPassword: 'Abcdef1x' });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password below minimum length (boundary: 7 chars)', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, newPassword: 'Abcde1x' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
            expect(errors[0].constraints).toHaveProperty('minLength');
        });

        it('should accept password at maximum length (boundary: 72 chars)', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, newPassword: 'Aa1' + 'x'.repeat(69) });
            const errors = await validate(dto);

            expect(errors.length).toBe(0);
        });

        it('should reject password above maximum length (boundary: 73 chars)', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, newPassword: 'Aa1' + 'x'.repeat(70) });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
            expect(errors[0].constraints).toHaveProperty('maxLength');
        });

        it('should reject password without complexity (no uppercase)', async () => {
            const dto = plainToInstance(ResetPasswordDto, { ...validData, newPassword: 'abcdefg1' });
            const errors = await validate(dto);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].property).toBe('newPassword');
            expect(errors[0].constraints).toHaveProperty('matches');
        });
    });

    it('should reject empty object', async () => {
        const dto = plainToInstance(ResetPasswordDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(2);
        expect(errors.map((e) => e.property).sort()).toEqual(['newPassword', 'token']);
    });
});
