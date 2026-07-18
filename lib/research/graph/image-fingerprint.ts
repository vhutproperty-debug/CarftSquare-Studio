import { createHash } from 'crypto';

/**
 * Deterministic image fingerprints for cross-portal duplicate detection.
 * Uses stable CDN/path tokens (not raw cache-busted URLs). When raw image
 * bytes are available, also computes an average-hash style digest.
 */
export function normalizeImageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    // Drop common CDN size/transform path segments for stability
    const path = u.pathname
      .replace(/\/(w_|h_|c_fill|q_auto|f_auto)[^/]*/gi, '')
      .replace(/\/\d+x\d+\//g, '/')
      .replace(/\/thumb(nail)?s?\//gi, '/');
    return `${u.origin}${path}`.toLowerCase();
  } catch {
    return url.split('?')[0]!.toLowerCase();
  }
}

/** Extract a stable media token (file id / uuid / long hash) from a URL. */
export function extractMediaToken(url: string): string | undefined {
  const normalized = normalizeImageUrl(url);
  const uuid = normalized.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  if (uuid) return uuid[0].toLowerCase();
  const longHex = normalized.match(/[a-f0-9]{16,}/i);
  if (longHex) return longHex[0].toLowerCase();
  const file = normalized.match(/\/([^/]+)\.(jpg|jpeg|png|webp)$/i);
  if (file) return file[1].toLowerCase();
  return undefined;
}

/**
 * Perceptual-style fingerprint:
 * - Prefer stable media token
 * - Else hash normalized URL
 * - Optional byte-level average hash when buffer provided
 */
export function fingerprintImage(input: {
  url?: string;
  bytes?: Buffer | Uint8Array;
}): string | undefined {
  if (input.bytes && input.bytes.length > 64) {
    // Lightweight block digest (not JPEG-decode dependent): sample bytes across image.
    const buf = Buffer.from(input.bytes);
    const samples: number[] = [];
    const step = Math.max(1, Math.floor(buf.length / 64));
    for (let i = 0; i < buf.length && samples.length < 64; i += step) {
      samples.push(buf[i]!);
    }
    const avg = samples.reduce((a, b) => a + b, 0) / Math.max(samples.length, 1);
    const bits = samples.map((v) => (v >= avg ? '1' : '0')).join('');
    return `ahash:${createHash('sha1').update(bits).digest('hex').slice(0, 16)}`;
  }
  if (!input.url) return undefined;
  const token = extractMediaToken(input.url);
  if (token) return `media:${token}`;
  return `url:${createHash('sha1').update(normalizeImageUrl(input.url)).digest('hex').slice(0, 16)}`;
}

export function fingerprintImageUrls(urls: string[]): string[] {
  const out = new Set<string>();
  for (const url of urls) {
    const fp = fingerprintImage({ url });
    if (fp) out.add(fp);
  }
  return [...out];
}

export function imageFingerprintOverlap(a: string[], b: string[]): {
  shared: string[];
  score: number;
} {
  if (!a.length || !b.length) return { shared: [], score: 0 };
  const setB = new Set(b);
  const shared = a.filter((x) => setB.has(x));
  const score = shared.length / Math.max(a.length, b.length);
  return { shared, score };
}

export function extractImageUrlsFromListing(listing: {
  extracted?: Record<string, unknown>;
  rawText?: string;
  url?: string;
}): string[] {
  const urls: string[] = [];
  const extracted = listing.extracted || {};
  const candidates = [
    extracted.images,
    extracted.imageUrls,
    extracted.photos,
    extracted.imageHashes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === 'string' && /^https?:\/\//i.test(item)) urls.push(item);
        else if (item && typeof item === 'object' && typeof (item as { url?: string }).url === 'string') {
          urls.push((item as { url: string }).url);
        }
      }
    }
  }
  const textUrls = (listing.rawText || '').match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi) || [];
  urls.push(...textUrls);
  return Array.from(new Set(urls)).slice(0, 20);
}
