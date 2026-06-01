import { BRAND } from '@/lib/brand';

export function getSiteDomain() {
  return process.env.NEXT_PUBLIC_SITE_DOMAIN || BRAND.domain || 'craftsquare.studio';
}

export function getSiteUrl() {
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return `https://${getSiteDomain()}`;
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
