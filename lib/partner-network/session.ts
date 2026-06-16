import crypto from 'node:crypto';

export const PARTNER_SESSION_COOKIE = 'pn_partner_session';
export const PARTNER_PROFILE_SESSION_COOKIE = 'pn_profile_session';
export const PARTNER_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
export const PARTNER_PROFILE_SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

function getSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET is required for partner sessions.');
  }
  return secret || 'dev-partner-session-secret';
}

type SessionPayload = { partnerId: string; id: string; mobile: string; exp: number; scope?: string };

function signToken(payload: Omit<SessionPayload, 'exp'>, maxAgeSec: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + maxAgeSec * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function readToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.partnerId || !data.id || !data.mobile || Date.now() > data.exp) return null;
    return data as SessionPayload;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function cookieHeader(name: string, token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function normalizePartnerMobile(mobile: string) {
  return String(mobile).replace(/\D/g, '').slice(-10);
}

export function signPartnerSession(payload: { partnerId: string; id: string; mobile: string }) {
  return signToken(payload, PARTNER_SESSION_MAX_AGE);
}

export function readPartnerSession(token: string | undefined | null) {
  return readToken(token);
}

export function signProfileSession(payload: { partnerId: string; id: string; mobile: string }) {
  return signToken({ ...payload, scope: 'profile' }, PARTNER_PROFILE_SESSION_MAX_AGE);
}

export function readProfileSession(token: string | undefined | null) {
  const data = readToken(token);
  if (!data || data.scope !== 'profile') return null;
  return data;
}

export function getPartnerSessionFromRequest(request: Request) {
  return readPartnerSession(readCookie(request, PARTNER_SESSION_COOKIE));
}

export function getProfileSessionFromRequest(request: Request) {
  return readProfileSession(readCookie(request, PARTNER_PROFILE_SESSION_COOKIE));
}

/** Full partner login session or short-lived post-registration profile session. */
export function getPartnerProfileAuthFromRequest(request: Request) {
  return getPartnerSessionFromRequest(request) || getProfileSessionFromRequest(request);
}

export function partnerSessionCookieHeader(token: string) {
  return cookieHeader(PARTNER_SESSION_COOKIE, token, PARTNER_SESSION_MAX_AGE);
}

export function profileSessionCookieHeader(token: string) {
  return cookieHeader(PARTNER_PROFILE_SESSION_COOKIE, token, PARTNER_PROFILE_SESSION_MAX_AGE);
}

export function clearPartnerSessionCookieHeader() {
  return cookieHeader(PARTNER_SESSION_COOKIE, '', 0);
}

export function clearProfileSessionCookieHeader() {
  return cookieHeader(PARTNER_PROFILE_SESSION_COOKIE, '', 0);
}
