import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session-constants';
import { getSessionFromRequest } from '@/lib/auth/session-edge';

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

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = await getSessionFromRequest(request);

  if (isProtectedAdminApi(pathname) || isProtectedDataApi(pathname)) {
    if (!session) {
      return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });
    }
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
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*', '/api/leads', '/api/dashboard', '/api/auth/:path*'],
};
