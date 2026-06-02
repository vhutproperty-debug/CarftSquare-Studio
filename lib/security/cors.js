import { BRAND } from '@/lib/brand';

const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(request) {
  try {
    return new URL(request.url).origin;
  } catch {
    const host = request.headers.get('host');
    if (!host) return null;
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`;
  }
}

function isSameOriginRequest(request, requestOrigin) {
  const normalized = normalizeOrigin(requestOrigin);
  const serverOrigin = getRequestOrigin(request);
  return Boolean(normalized && serverOrigin && normalized === serverOrigin);
}

function isVercelDeploymentOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

function getVercelOrigins() {
  const origins = [];
  for (const key of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
    const normalized = normalizeOrigin(process.env[key]);
    if (normalized) origins.push(normalized);
  }
  return origins;
}

export function getAllowedOrigins() {
  const origins = new Set(DEFAULT_DEV_ORIGINS.map(normalizeOrigin).filter(Boolean));

  const configured = String(process.env.CORS_ORIGINS || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    configured.split(',').forEach((entry) => {
      const normalized = normalizeOrigin(entry.trim());
      if (normalized) origins.add(normalized);
    });
  }

  if (process.env.NODE_ENV === 'production') {
    const domain = process.env.NEXT_PUBLIC_SITE_DOMAIN || BRAND.domain;
    origins.add(`https://${domain}`);
    origins.add(`https://www.${domain}`);
    getVercelOrigins().forEach((origin) => origins.add(origin));
  }

  return [...origins];
}

export function resolveCorsOrigin(request) {
  const requestOrigin = request.headers.get('origin');

  if (!requestOrigin) {
    return getAllowedOrigins()[0] || getRequestOrigin(request) || null;
  }

  const normalized = normalizeOrigin(requestOrigin);
  if (!normalized) return null;

  // Same-origin browser requests (e.g. /admin → /api/auth/login) must always pass.
  if (isSameOriginRequest(request, requestOrigin)) {
    return normalized;
  }

  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes('*')) {
    return '*';
  }

  if (allowedOrigins.includes(normalized)) {
    return normalized;
  }

  // Vercel preview and branch deployments share one codebase — allow *.vercel.app on Vercel.
  if (process.env.VERCEL === '1' && isVercelDeploymentOrigin(normalized)) {
    return normalized;
  }

  return null;
}

export function getCorsHeaders(request) {
  const origin = resolveCorsOrigin(request);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

export function applyCorsHeaders(response, request) {
  const corsHeaders = getCorsHeaders(request);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function isOriginAllowed(request) {
  if (!request.headers.get('origin')) return true;
  return Boolean(resolveCorsOrigin(request));
}
