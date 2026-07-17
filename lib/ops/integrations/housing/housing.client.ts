import { createHmac } from 'node:crypto';
import {
  getHousingApiBaseUrl,
  getHousingHmacKey,
  getHousingPartnerId,
  isHousingApiConfigured,
  validateHousingConfig,
} from '@/lib/env/housing';
import {
  HOUSING_MAX_WINDOW_SECONDS,
  type HousingApiLead,
  type HousingApiResponse,
  type HousingChunkResult,
} from '@/lib/ops/integrations/housing/housing.types';

export const HOUSING_DEMAND_ENDPOINT = 'get-builder-leads' as const;

const RETRY_DELAYS_MS = [0, 500, 1500];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const DEFAULT_FETCH_DAYS = 90;
const REQUEST_TIMEOUT_MS = 30_000;

export type HousingApiCallResult = {
  ok: boolean;
  httpStatus: number;
  leads: HousingApiLead[];
  endpoint: string;
  errorMessage?: string;
  zeroResult?: boolean;
  chunksAttempted: number;
  chunksCompleted: number;
  chunkResults: HousingChunkResult[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveHousingDemandEndpoint(): string {
  const base = getHousingApiBaseUrl().replace(/\/$/, '');
  if (base.includes(HOUSING_DEMAND_ENDPOINT)) return base;
  return `${base}/${HOUSING_DEMAND_ENDPOINT}`;
}

/** HMAC-SHA256 hex digest — message is current_time only; key is HOUSING_API_KEY. */
export function buildHousingAuthHash(currentTime: string): string {
  return createHmac('sha256', getHousingHmacKey()).update(currentTime).digest('hex');
}

/** Build request URL with Unix-second start_date / end_date. */
function buildLeadsRequestUrl(options: { startUnix: number; endUnix: number }): string {
  const currentTime = String(Math.floor(Date.now() / 1000));
  const hash = buildHousingAuthHash(currentTime);
  const params = new URLSearchParams({
    id: getHousingPartnerId(),
    current_time: currentTime,
    hash,
    start_date: String(options.startUnix),
    end_date: String(options.endUnix),
  });
  return `${resolveHousingDemandEndpoint()}?${params.toString()}`;
}

function sanitizeApiMessage(raw: string): string {
  return raw
    .trim()
    .slice(0, 180)
    .replace(/[0-9a-f]{32,}/gi, '<redacted>')
    .replace(/\b\d{10,}\b/g, '<num>');
}

function buildSafeErrorMessage(httpStatus: number, body: string): string {
  const trimmed = sanitizeApiMessage(body);
  if (httpStatus === 401) {
    return 'Housing API authentication failed. Verify encryption key and profile ID.';
  }
  if (httpStatus === 422) {
    return 'Housing API rejected the request (missing or invalid parameters).';
  }
  if (httpStatus === 429) {
    return 'Housing API rate limit exceeded.';
  }
  if (trimmed) {
    return `Housing API error ${httpStatus}: ${trimmed}`;
  }
  return `Housing API error ${httpStatus}.`;
}

type ParsedHousingBody =
  | { kind: 'leads'; leads: HousingApiLead[] }
  | { kind: 'api_error'; message: string }
  | { kind: 'unexpected'; message: string };

function parseHousingSuccessBody(json: unknown): ParsedHousingBody {
  if (Array.isArray(json)) {
    return { kind: 'leads', leads: json as HousingApiLead[] };
  }

  if (!json || typeof json !== 'object') {
    return { kind: 'unexpected', message: 'Housing API returned an unexpected response type.' };
  }

  const record = json as HousingApiResponse & Record<string, unknown>;

  if (Array.isArray(record.leads)) return { kind: 'leads', leads: record.leads };
  if (Array.isArray(record.data)) return { kind: 'leads', leads: record.data };
  if (Array.isArray(record.results)) return { kind: 'leads', leads: record.results };

  if (typeof record.message === 'string' && record.message.trim()) {
    return { kind: 'api_error', message: sanitizeApiMessage(record.message) };
  }

  return {
    kind: 'unexpected',
    message: `Housing API returned an unexpected JSON shape (keys: ${Object.keys(record).slice(0, 8).join(', ') || 'none'}).`,
  };
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`Housing API returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError || new Error('Housing API request failed.');
}

export function resolveHousingUnixRange(options: {
  since?: string;
  days?: number;
} = {}): { startUnix: number; endUnix: number } {
  const endUnix = Math.floor(Date.now() / 1000);
  let startUnix: number;

  if (options.since) {
    const parsed = new Date(options.since);
    if (!Number.isNaN(parsed.getTime())) {
      startUnix = Math.floor(parsed.getTime() / 1000);
    } else {
      startUnix = endUnix - (options.days ?? DEFAULT_FETCH_DAYS) * 24 * 60 * 60;
    }
  } else {
    startUnix = endUnix - (options.days ?? DEFAULT_FETCH_DAYS) * 24 * 60 * 60;
  }

  if (startUnix > endUnix) {
    return { startUnix: endUnix, endUnix };
  }
  return { startUnix, endUnix };
}

/**
 * Split [startUnix, endUnix] into inclusive chunks of at most HOUSING_MAX_WINDOW_SECONDS.
 * Adjacent chunks share the boundary second so leads cannot fall into a gap.
 */
export function buildHousingUnixChunks(
  startUnix: number,
  endUnix: number,
  maxWindowSeconds = HOUSING_MAX_WINDOW_SECONDS,
): Array<{ startUnix: number; endUnix: number }> {
  if (startUnix > endUnix) return [{ startUnix: endUnix, endUnix }];
  if (endUnix - startUnix <= maxWindowSeconds) {
    return [{ startUnix, endUnix }];
  }

  const chunks: Array<{ startUnix: number; endUnix: number }> = [];
  let cursor = startUnix;
  while (cursor < endUnix) {
    const chunkEnd = Math.min(cursor + maxWindowSeconds, endUnix);
    chunks.push({ startUnix: cursor, endUnix: chunkEnd });
    if (chunkEnd >= endUnix) break;
    cursor = chunkEnd;
  }
  return chunks;
}

async function fetchHousingChunk(
  startUnix: number,
  endUnix: number,
): Promise<HousingChunkResult & { leads: HousingApiLead[] }> {
  const windowSeconds = endUnix - startUnix;
  if (windowSeconds > HOUSING_MAX_WINDOW_SECONDS) {
    return {
      startUnix,
      endUnix,
      httpStatus: 0,
      ok: false,
      leadsFetched: 0,
      leads: [],
      errorMessage: `Housing chunk window exceeds ${HOUSING_MAX_WINDOW_SECONDS} seconds.`,
    };
  }

  const url = buildLeadsRequestUrl({ startUnix, endUnix });

  try {
    const response = await fetchWithRetry(url);
    const bodyText = await response.text().catch(() => '');

    if (!response.ok) {
      return {
        startUnix,
        endUnix,
        httpStatus: response.status,
        ok: false,
        leadsFetched: 0,
        leads: [],
        errorMessage: buildSafeErrorMessage(response.status, bodyText),
      };
    }

    let json: unknown = null;
    if (bodyText) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        return {
          startUnix,
          endUnix,
          httpStatus: response.status,
          ok: false,
          leadsFetched: 0,
          leads: [],
          errorMessage: 'Housing API returned an invalid JSON response.',
        };
      }
    } else {
      json = [];
    }

    const parsed = parseHousingSuccessBody(json);
    if (parsed.kind === 'api_error') {
      return {
        startUnix,
        endUnix,
        httpStatus: response.status,
        ok: false,
        leadsFetched: 0,
        leads: [],
        errorMessage: `Housing API rejected the date window: ${parsed.message}`,
      };
    }
    if (parsed.kind === 'unexpected') {
      return {
        startUnix,
        endUnix,
        httpStatus: response.status,
        ok: false,
        leadsFetched: 0,
        leads: [],
        errorMessage: parsed.message,
      };
    }

    return {
      startUnix,
      endUnix,
      httpStatus: response.status,
      ok: true,
      leadsFetched: parsed.leads.length,
      leads: parsed.leads,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Housing API request failed.';
    return {
      startUnix,
      endUnix,
      httpStatus: 0,
      ok: false,
      leadsFetched: 0,
      leads: [],
      errorMessage: message,
    };
  }
}

function emptyResult(
  endpoint: string,
  patch: Partial<HousingApiCallResult> = {},
): HousingApiCallResult {
  return {
    ok: false,
    httpStatus: 0,
    leads: [],
    endpoint,
    chunksAttempted: 0,
    chunksCompleted: 0,
    chunkResults: [],
    ...patch,
  };
}

async function callHousingLeadsApi(options: {
  since?: string;
  days?: number;
} = {}): Promise<HousingApiCallResult> {
  const endpoint = resolveHousingDemandEndpoint();
  const validation = validateHousingConfig();
  if (!validation.ok) {
    return emptyResult(endpoint, {
      errorMessage: `Missing Housing credentials: ${validation.missing.join(', ')}`,
    });
  }

  const range = resolveHousingUnixRange(options);
  const chunks = buildHousingUnixChunks(range.startUnix, range.endUnix);
  const chunkResults: HousingChunkResult[] = [];
  const leadsByExternalKey = new Map<string, HousingApiLead>();
  let lastHttpStatus = 0;
  let chunksCompleted = 0;
  const errors: string[] = [];

  for (const chunk of chunks) {
    const result = await fetchHousingChunk(chunk.startUnix, chunk.endUnix);
    lastHttpStatus = result.httpStatus || lastHttpStatus;
    chunkResults.push({
      startUnix: result.startUnix,
      endUnix: result.endUnix,
      httpStatus: result.httpStatus,
      ok: result.ok,
      leadsFetched: result.leadsFetched,
      errorMessage: result.errorMessage,
    });

    if (!result.ok) {
      if (result.errorMessage) errors.push(result.errorMessage);
      continue;
    }

    chunksCompleted += 1;
    for (const lead of result.leads) {
      // Deduplicate across overlapping chunk boundaries using a stable fingerprint of raw fields.
      const key = [
        lead.flat_id ?? '',
        lead.lead_date ?? '',
        lead.lead_phone ?? lead.mobile ?? lead.phone ?? '',
        lead.project_name ?? lead.project ?? '',
      ].join('|');
      if (!leadsByExternalKey.has(key)) {
        leadsByExternalKey.set(key, lead);
      }
    }
  }

  const leads = [...leadsByExternalKey.values()];
  const allChunksOk = chunksCompleted === chunks.length && chunks.length > 0;

  if (!allChunksOk) {
    return {
      ok: false,
      httpStatus: lastHttpStatus,
      leads,
      endpoint,
      errorMessage: errors[0] || 'One or more Housing API date chunks failed.',
      zeroResult: false,
      chunksAttempted: chunks.length,
      chunksCompleted,
      chunkResults,
    };
  }

  return {
    ok: true,
    httpStatus: lastHttpStatus || 200,
    leads,
    endpoint,
    zeroResult: leads.length === 0,
    chunksAttempted: chunks.length,
    chunksCompleted,
    chunkResults,
  };
}

/** Validates credentials against the Housing.com pull API without importing leads. */
export async function verifyHousingConnection(): Promise<HousingApiCallResult> {
  return callHousingLeadsApi({ days: 1 });
}

/** Server-side Housing.com API client. Credentials from environment only. */
export async function fetchHousingLeads(options: { since?: string; days?: number } = {}): Promise<HousingApiLead[]> {
  if (!isHousingApiConfigured()) {
    return [];
  }
  const result = await callHousingLeadsApi(options);
  if (!result.ok) {
    throw new Error(result.errorMessage || 'Unable to fetch Housing.com leads.');
  }
  return result.leads;
}

export async function fetchHousingLeadsWithStatus(
  options: { since?: string; days?: number } = {},
): Promise<HousingApiCallResult> {
  return callHousingLeadsApi(options);
}

export function isHousingClientConfigured(): boolean {
  return isHousingApiConfigured();
}
