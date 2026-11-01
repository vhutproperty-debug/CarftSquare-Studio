import { parseCookieHeader, SESSION_COOKIE } from '@/lib/auth/session-constants';

type CookiePair = { name: string; value: string };

/**
 * Rebuild the Cookie header from the Next.js cookie store.
 * `cookies().get(name)` returns a single value and can miss the signed
 * session when the browser also sends an empty same-name cookie (a more
 * specific Path wins in some stores). API routes already fall back to the
 * raw Cookie header via getSessionTokenFromRequest. The ops layout must too.
 */
export function cookieHeaderFromPairs(cookies: CookiePair[]): string {
  return cookies
    .filter((cookie) => cookie.name)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export function sessionTokenFromCookieSources(input: {
  direct?: string | null;
  cookieHeader?: string | null;
}): string | undefined {
  const direct = String(input.direct || '');
  const fromHeader = input.cookieHeader
    ? String(parseCookieHeader(input.cookieHeader)[SESSION_COOKIE] || '')
    : '';
  const candidates = [direct, fromHeader].filter((value) => value.length > 0);
  if (!candidates.length) return undefined;
  return candidates.sort((left, right) => right.length - left.length)[0];
}
