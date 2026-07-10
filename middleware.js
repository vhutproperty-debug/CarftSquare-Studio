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

function isOpsPage(pathname) {
  return pathname === '/ops' || pathname.startsWith('/ops/');
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (
    !pathname.startsWith('/api/')
    && !pathname.startsWith('/_next/')
    && !pathname.startsWith('/admin')
    && !pathname.startsWith('/ops')
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

  if (isProtectedAdminApi(pathname) || isProtectedDataApi(pathname) || isProtectedOpsApi(pathname)) {
    if (!session) {
      return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
    }
  }

  if (isOpsPage(pathname)) {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  if (pathname.startsWith('/api/auth/') && !isPublicAuthPath(pathname)) {
    if (!session) {
      return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
    }
  }

  if (session && request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  return NextResponse.next();
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
    '/api/auth/:path*',
  ],
};
