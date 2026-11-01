import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session-constants';
import { getSessionFromRequest } from '@/lib/auth/session-edge';
import { shouldNormalizePath, normalizeDynamicPath, cleanPathname } from '@/lib/seo/urls';

const PUBLIC_AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/setup',
  '/api/auth/status',
  '/api/auth/logout',
]);

/**
 * Headless cron entry points. Middleware must not 401 these before the route
 * runs: Vercel Cron and GitHub Actions send Authorization: Bearer CRON_SECRET
 * (or a route-specific secret header) and have no admin session cookie.
 * The route still checks that secret, then falls back to requireOpsEditAccess
 * (research tick uses requireResearchEditAccess).
 */
const CRON_AUTH_PATHS = new Set([
  '/api/ops/followups/tick',
  '/api/ops/whatsapp/templates/sync',
  '/api/ops/ads/insights/sync',
  '/api/research/scheduler/tick',
]);

export function isCronAuthPath(pathname) {
  const path = String(pathname || '');
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return CRON_AUTH_PATHS.has(normalized);
}

function isPublicAuthPath(pathname) {
  return PUBLIC_AUTH_PATHS.has(pathname);
}

function isProtectedAdminApi(pathname) {
  return pathname.startsWith('/api/admin/');
}

function isProtectedDataApi(pathname) {
  return pathname === '/api/leads' || pathname === '/api/dashboard';
}

function isProtectedOpsApi(pathname) {
  return pathname.startsWith('/api/ops/');
}

function isProtectedResearchApi(pathname) {
  return pathname.startsWith('/api/research/');
}

function isOpsPage(pathname) {
  return pathname === '/ops' || pathname.startsWith('/ops/');
}

function isResearchPage(pathname) {
  return pathname === '/research' || pathname.startsWith('/research/');
}

function appPageHeaders(response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

/**
 * Continue with the original request headers.
 * NextResponse.next() with response header edits and no request copy can drop
 * the Cookie header before the ops layout reads the admin session.
 */
function continueRequest(request) {
  return NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    !pathname.startsWith('/api/')
    && !pathname.startsWith('/_next/')
    && !pathname.startsWith('/admin')
    && !pathname.startsWith('/ops')
    && !pathname.startsWith('/research')
    && shouldNormalizePath(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = normalizeDynamicPath(cleanPathname(pathname));
    return NextResponse.redirect(url, 308);
  }

  let session = null;
  try {
    session = await getSessionFromRequest(request);
  } catch {
    session = null;
  }

  if (
    !isCronAuthPath(pathname)
    && (
      isProtectedAdminApi(pathname)
      || isProtectedDataApi(pathname)
      || isProtectedOpsApi(pathname)
      || isProtectedResearchApi(pathname)
    )
  ) {
    if (!session) {
      return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
    }
  }

  if (isOpsPage(pathname) || isResearchPage(pathname)) {
    return appPageHeaders(continueRequest(request));
  }

  if (pathname.startsWith('/admin')) {
    return appPageHeaders(continueRequest(request));
  }

  if (pathname.startsWith('/api/auth/') && !isPublicAuthPath(pathname)) {
    if (!session) {
      return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
    }
  }

  if (session && request.cookies.get(SESSION_COOKIE)?.value) {
    return continueRequest(request);
  }

  return continueRequest(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/leads',
    '/api/dashboard',
    '/ops',
    '/ops/:path*',
    '/api/ops/:path*',
    '/research',
    '/research/:path*',
    '/api/research/:path*',
    '/api/auth/:path*',
  ],
};
