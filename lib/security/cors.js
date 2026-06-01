const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function getAllowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    return [`https://${process.env.NEXT_PUBLIC_SITE_DOMAIN || 'craftsquare.studio'}`];
  }
  return DEFAULT_DEV_ORIGINS;
}

export function resolveCorsOrigin(request) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) {
    return allowedOrigins[0] || null;
  }
  if (allowedOrigins.includes('*')) {
    return '*';
  }
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
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
