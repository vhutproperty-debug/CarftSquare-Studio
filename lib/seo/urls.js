import { slugify } from '@/lib/cms/normalize';

export function cleanPathname(pathname = '/') {
  let path = String(pathname || '/');
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path || '/';
}

export function normalizeSlugSegment(segment = '') {
  return slugify(segment);
}

export function normalizeDynamicPath(pathname = '/') {
  const cleaned = cleanPathname(pathname);
  const parts = cleaned.split('/').filter(Boolean);

  if (parts[0] === 'blog' && parts[1]) {
    parts[1] = normalizeSlugSegment(parts[1]);
  }
  if (parts[0] === 'services' && parts[1]) {
    parts[1] = normalizeSlugSegment(parts[1]);
  }

  return parts.length ? `/${parts.join('/')}` : '/';
}

export function buildCanonicalPath(path = '/') {
  const normalized = normalizeDynamicPath(path);
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function pathsEqual(a = '/', b = '/') {
  return cleanPathname(a).toLowerCase() === cleanPathname(b).toLowerCase();
}

export function shouldNormalizePath(pathname = '/') {
  const cleaned = cleanPathname(pathname);
  const normalized = normalizeDynamicPath(pathname);
  return cleaned !== normalized || pathname !== cleaned;
}
