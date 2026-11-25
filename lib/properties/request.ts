/** Best-effort client IP and user agent from Vercel / proxy headers. */
export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get('x-real-ip')?.trim();
  return real ? real.slice(0, 64) : 'unknown';
}

export function getRequestUserAgent(request: Request): string {
  return String(request.headers.get('user-agent') || '').slice(0, 400);
}
