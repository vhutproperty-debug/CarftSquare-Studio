import { createHmac, timingSafeEqual } from 'crypto';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getSessionCookieOptions,
  getSessionSecret,
  getSessionTokenFromRequest,
  parseSessionPayload,
} from '@/lib/auth/session-constants';

export { SESSION_COOKIE, SESSION_MAX_AGE, getSessionCookieOptions };

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
  const signatureBuffer = Buffer.from(signature || '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  return parseSessionPayload(encoded);
}

export function getSessionFromRequest(request) {
  return readSessionToken(getSessionTokenFromRequest(request));
}
