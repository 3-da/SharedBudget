/**
 * Masks an email address for safe logging.
 * Example: "user@example.com" → "u***@example.com"
 */
export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return `${local[0]}***@${domain}`;
}
