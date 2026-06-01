export const SESSION_COOKIE = 'bb_admin_session';
export const SESSION_MAX_AGE = 60 * 60 * 12;

export function hasSessionSecret() {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
}

export function getSessionSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production.');
  }
  return 'dev-only-insecure-secret';
}

/** Edge-safe: returns null instead of throwing when the secret is missing in production. */
export function getSessionSecretOrNull() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') return null;
  return 'dev-only-insecure-secret';
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

export function parseCookieHeader(cookieHeader) {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function getSessionTokenFromRequest(request) {
  return request.cookies?.get?.(SESSION_COOKIE)?.value
    || parseCookieHeader(request.headers?.get?.('cookie') || '')[SESSION_COOKIE];
}

export function parseSessionPayload(encoded) {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const json = atob(base64 + padding);
    const payload = JSON.parse(json);
    if (!payload?.exp || payload.exp < Date.now() || payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}
