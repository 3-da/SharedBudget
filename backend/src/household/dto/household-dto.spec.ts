import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JoinByCodeDto } from './join-by-code.dto';
import { TransferOwnershipDto } from './transfer-ownership.dto';
import { RespondInvitationDto } from './respond-invitation.dto';
import { InviteToHouseholdDto } from './invite-to-household.dto';

describe('JoinByCodeDto', () => {
    it('should accept valid invite code', async () => {
        const dto = plainToInstance(JoinByCodeDto, { inviteCode: 'a1b2c3d4' });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject empty invite code', async () => {
        const dto = plainToInstance(JoinByCodeDto, { inviteCode: '' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('inviteCode');
        expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should reject non-string invite code', async () => {
        const dto = plainToInstance(JoinByCodeDto, { inviteCode: 12345678 });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('inviteCode');
    });

    it('should reject missing invite code', async () => {
        const dto = plainToInstance(JoinByCodeDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('inviteCode');
    });
});

describe('TransferOwnershipDto', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('should accept valid UUID', async () => {
        const dto = plainToInstance(TransferOwnershipDto, { targetUserId: validUuid });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject non-UUID string', async () => {
        const dto = plainToInstance(TransferOwnershipDto, { targetUserId: 'not-a-uuid' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('targetUserId');
        expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should reject empty string', async () => {
        const dto = plainToInstance(TransferOwnershipDto, { targetUserId: '' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('targetUserId');
    });

    it('should reject missing targetUserId', async () => {
        const dto = plainToInstance(TransferOwnershipDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('targetUserId');
    });
});

describe('RespondInvitationDto', () => {
    it('should accept true (accept invitation)', async () => {
        const dto = plainToInstance(RespondInvitationDto, { accept: true });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should accept false (decline invitation)', async () => {
        const dto = plainToInstance(RespondInvitationDto, { accept: false });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject non-boolean value', async () => {
        const dto = plainToInstance(RespondInvitationDto, { accept: 'yes' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('accept');
        expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should reject missing accept field', async () => {
        const dto = plainToInstance(RespondInvitationDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('accept');
    });
});

describe('InviteToHouseholdDto', () => {
    it('should accept valid email', async () => {
        const dto = plainToInstance(InviteToHouseholdDto, { email: 'partner@example.com' });
        const errors = await validate(dto);

        expect(errors.length).toBe(0);
    });

    it('should reject invalid email format', async () => {
        const dto = plainToInstance(InviteToHouseholdDto, { email: 'not-an-email' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('email');
        expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should reject empty email', async () => {
        const dto = plainToInstance(InviteToHouseholdDto, { email: '' });
        const errors = await validate(dto);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('email');
    });

    it('should reject missing email', async () => {
        const dto = plainToInstance(InviteToHouseholdDto, {});
        const errors = await validate(dto);

        expect(errors.length).toBe(1);
        expect(errors[0].property).toBe('email');
    });
});
