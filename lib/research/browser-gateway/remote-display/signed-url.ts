import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { REMOTE_VIEW_TTL_MS } from '@/lib/research/browser-gateway/remote-display/types';

export type RemoteViewTokenPayload = {
  /** Public view id */
  v: string;
  /** Connect session id */
  c: string;
  /** Expiry epoch ms */
  exp: number;
  /** One-time nonce */
  n: string;
};

function viewSecret(): string {
  const secret =
    process.env.RESEARCH_REMOTE_VIEW_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('RESEARCH_REMOTE_VIEW_SECRET or AUTH_SECRET is required for remote view URLs.');
  }
  return secret;
}

export function createViewId(): string {
  return randomBytes(24).toString('hex');
}

export function signRemoteViewToken(input: {
  viewId: string;
  connectSessionId: string;
  ttlMs?: number;
}): { token: string; expiresAt: Date; payload: RemoteViewTokenPayload } {
  const payload: RemoteViewTokenPayload = {
    v: input.viewId,
    c: input.connectSessionId,
    exp: Date.now() + (input.ttlMs ?? REMOTE_VIEW_TTL_MS),
    n: randomBytes(16).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', viewSecret()).update(body).digest('base64url');
  return {
    token: `${body}.${sig}`,
    expiresAt: new Date(payload.exp),
    payload,
  };
}

export function verifyRemoteViewToken(
  token: string,
  expectedViewId: string,
): { ok: true; payload: RemoteViewTokenPayload } | { ok: false; reason: string } {
  if (!token || !token.includes('.')) return { ok: false, reason: 'missing_token' };
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'malformed_token' };

  const expected = createHmac('sha256', viewSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let payload: RemoteViewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }

  if (!payload?.v || !payload?.c || !payload?.exp) {
    return { ok: false, reason: 'incomplete_payload' };
  }
  if (payload.v !== expectedViewId) return { ok: false, reason: 'view_mismatch' };
  if (Date.now() > payload.exp) return { ok: false, reason: 'expired' };
  return { ok: true, payload };
}

export function tokenFingerprint(token: string): string {
  return createHmac('sha256', 'fp').update(token).digest('hex').slice(0, 16);
}

/** Public worker base URL used in liveViewUrl (Railway HTTPS). */
export function getWorkerPublicBaseUrl(): string {
  const explicit = process.env.RESEARCH_BROWSER_WORKER_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) {
    const host = railway.replace(/^https?:\/\//, '');
    return `https://${host}`;
  }

  // Local worker fallback — UI still gets a path; open only works if worker is reachable.
  const port = process.env.PORT || process.env.RESEARCH_BROWSER_WORKER_PORT || '4173';
  return `http://127.0.0.1:${port}`;
}

export function buildLiveViewUrl(viewId: string, token: string): string {
  const base = getWorkerPublicBaseUrl();
  const path = `remote/${viewId}/vnc.html`;
  const qs = new URLSearchParams({
    autoconnect: '1',
    resize: 'scale',
    // Token inside the websockify path: the WS upgrade authenticates by query
    // token even when third-party cookie blocking strips the iframe cookie.
    path: `remote/${viewId}/websockify?t=${token}`,
    t: token,
  });
  return `${base}/${path}?${qs.toString()}`;
}
