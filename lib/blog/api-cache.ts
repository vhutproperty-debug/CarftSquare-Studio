import { NextResponse } from 'next/server';

export const revalidate = 3600;

const CACHE_HEADER = 'public, s-maxage=3600, stale-while-revalidate=86400';

export function jsonWithCache<T>(body: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if ((init.status ?? 200) >= 400) {
    headers.set('Cache-Control', 'no-store');
  } else {
    headers.set('Cache-Control', CACHE_HEADER);
  }
  return NextResponse.json(body, { ...init, headers });
}
