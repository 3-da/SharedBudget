/**
 * Extracts a human-readable error message from an HTTP error response.
 * Handles both single-string and array-of-strings message formats
 * returned by NestJS validation pipes.
 */
export function extractHttpError(err: unknown, fallback?: string): string | null {
  const msg = (err as any)?.error?.message;
  if (!msg) return fallback ?? null;
  return Array.isArray(msg) ? msg.join(', ') : msg;
}
