import { describe, expect, it } from 'vitest';
import { maskEmail } from './mask-email';

describe('maskEmail', () => {
    it('should mask the local part of an email', () => {
        expect(maskEmail('user@example.com')).toBe('u***@example.com');
    });

    it('should handle single-character local part', () => {
        expect(maskEmail('a@example.com')).toBe('a***@example.com');
    });

    it('should preserve the full domain', () => {
        expect(maskEmail('admin@subdomain.example.co.uk')).toBe('a***@subdomain.example.co.uk');
    });

    it('should return *** for invalid email without @', () => {
        expect(maskEmail('notanemail')).toBe('***');
    });
});
