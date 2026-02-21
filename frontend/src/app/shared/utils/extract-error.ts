/**
 * Extracts a human-readable error message from an HTTP error response.
 * Handles both single-string and array-of-strings message formats
 * returned by NestJS validation pipes.
 *
 * @param err - The error object from an HTTP response
 * @param fallback - Optional fallback message if no error message is found
 * @returns The extracted message, the fallback, or null
 */
export function extractHttpError(err: unknown, fallback?: string): string | null {
  const msg = (err as any)?.error?.message;
  if (!msg) return fallback ?? null;
  return Array.isArray(msg) ? msg.join(', ') : msg;
}
