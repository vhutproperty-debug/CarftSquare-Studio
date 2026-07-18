/** Sanitize errors for client responses — never leak driver internals. */
export function publicOpsError(
  error: unknown,
  fallback: string,
): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message || fallback;
  // Allow known validation messages from our own throws
  if (
    message.includes('required')
    || message.includes('allowed')
    || message.includes('exceeds')
    || message.includes('empty')
    || message.includes('not found')
    || message.includes('already')
    || message.includes('hash does not match')
    || message.includes('Invalid file')
    || message.includes('Only WhatsApp')
    || message.includes('in progress')
    || message.includes('No existing inventory')
  ) {
    return message;
  }
  return fallback;
}
