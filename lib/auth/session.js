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

const ALLOWED_ADMIN_ROLES = new Set(['admin', 'super_admin']);

function decodeSessionPayloadRaw(encoded) {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const json = Buffer.from(base64 + padding, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Inspects a session token without conflating expiry and invalid signature.
 * Used by /api/auth/status — the single authorization authority.
 */
export function inspectSessionToken(token) {
  if (!token || !token.includes('.')) {
    return { state: 'missing' };
  }

  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const signatureBuffer = Buffer.from(signature || '', 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { state: 'invalid' };
  }

  const payload = decodeSessionPayloadRaw(encoded);
  if (!payload || !ALLOWED_ADMIN_ROLES.has(payload.role)) {
    return { state: 'invalid' };
  }
  if (!payload.exp || payload.exp < Date.now()) {
    return { state: 'expired', payload };
  }

  return { state: 'valid', payload };
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
