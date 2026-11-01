import { BRAND } from '@/lib/brand';

export function getSiteDomain() {
  return process.env.NEXT_PUBLIC_SITE_DOMAIN || BRAND.domain || 'craftsquare.studio';
}

export function getSiteUrl() {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  let url = configured ? configured.replace(/\/$/, '') : `https://${getSiteDomain()}`;
  const production = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (production && url.startsWith('http://')) {
    url = `https://${url.slice('http://'.length)}`;
  }
  return url;
}

export function absoluteUrl(path = '/') {
  const base = getSiteUrl();
  if (!path || path === '/') {
    return `${base}/`;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function getMetadataBase() {
  return new URL(getSiteUrl());
}
