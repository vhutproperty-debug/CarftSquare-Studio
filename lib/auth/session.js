import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'bb_admin_session';
export const SESSION_MAX_AGE = 60 * 60 * 12;

export function getSessionSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required in production.');
  }
  return 'dev-only-insecure-secret';
}

export function signSession(admin) {
  const payload = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role || 'admin',
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function readSessionToken(token) {
  if (!token || !token.includes('.')) return null;

  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const signatureBuffer = Buffer.from(signature || '');
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Date.now() || payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request) {
  const token = request.cookies?.get?.(SESSION_COOKIE)?.value
    || parseCookieHeader(request.headers?.get?.('cookie') || '')[SESSION_COOKIE];
  return readSessionToken(token);
}

function parseCookieHeader(cookieHeader) {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
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
