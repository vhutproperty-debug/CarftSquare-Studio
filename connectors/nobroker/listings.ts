/**
 * NoBroker listing extraction via the authenticated filter API.
 * DOM harvesting only sees nav/marketing chrome — property cards are hydrated
 * from /api/v3/multi/property/{RENT|SALE}/filter.
 */

import type { Page, Response } from 'playwright';
import { parseBhk } from '@/connectors/common/listing-parser';
import {
  filterGenuineListingUrls,
  isGenuineListingUrl,
} from '@/connectors/common/listing-url';
import type { ResearchListing } from '@/lib/research/types';

type NobrokerProperty = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value != null ? String(value).trim() : '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function pickDetailUrl(prop: NobrokerProperty, mode: 'rent' | 'sale'): string {
  const direct = [
    prop.detailUrl,
    prop.shortUrl,
    prop.url,
    prop.pageUrl,
    prop.propertyUrl,
    prop.seoUrl,
  ]
    .map(asString)
    .find((u) => /^https?:\/\//i.test(u));
  if (direct) return direct.split('#')[0];

  const id = asString(prop.id || prop.propertyId || prop.nbId);
  if (!id) return '';
  const city = slugify(asString(prop.city || prop.cityName || 'mumbai')) || 'mumbai';
  const locality =
    slugify(asString(prop.locality || prop.nbLocality || prop.street || 'india')) || 'india';
  const building = slugify(
    asString(prop.buildingName || prop.society || prop.propertyTitle || prop.title || 'property'),
  );
  const pathBuilding = building || 'property';
  return `https://www.nobroker.in/property/${mode}/${city}/${locality}/${pathBuilding}/${id}`;
}

function propertiesFromPayload(payload: unknown): NobrokerProperty[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const candidates = [root.data, root.properties, root.propertyList, root.list, root];
  for (const c of candidates) {
    if (Array.isArray(c)) return c.filter((x) => x && typeof x === 'object') as NobrokerProperty[];
    if (c && typeof c === 'object') {
      const nested = c as Record<string, unknown>;
      for (const key of ['data', 'properties', 'propertyList', 'list', 'otherProperties']) {
        if (Array.isArray(nested[key])) {
          return (nested[key] as unknown[]).filter(
            (x) => x && typeof x === 'object',
          ) as NobrokerProperty[];
        }
      }
    }
  }
  return [];
}

export function mapNobrokerProperty(
  prop: NobrokerProperty,
  portal = 'nobroker',
): ResearchListing | null {
  const modeHint = asString(prop.mode || prop.propertyType || prop.nbpt).toUpperCase();
  const mode: 'rent' | 'sale' = modeHint.includes('SALE') || modeHint.includes('BUY') ? 'sale' : 'rent';
  const url = pickDetailUrl(prop, mode);
  if (!url || !isGenuineListingUrl(portal, url)) return null;

  const title =
    asString(prop.propertyTitle || prop.title || prop.society || prop.buildingName) ||
    'NoBroker listing';
  const bhk =
    parseBhk(asString(prop.bhk || prop.type || prop.title || prop.propertyTitle)) ??
    asNumber(prop.bedroom) ??
    asNumber(prop.bedrooms);
  const rent = mode === 'rent' ? asNumber(prop.rent ?? prop.price ?? prop.minRent) : undefined;
  const salePrice = mode === 'sale' ? asNumber(prop.price ?? prop.salePrice) : undefined;
  const areaSqft = asNumber(prop.propertySize ?? prop.area ?? prop.carpetArea);
  const locality = asString(prop.locality || prop.nbLocality || prop.street) || undefined;

  return {
    id: `${portal}:${url}`,
    portal,
    title: title.slice(0, 180),
    locality,
    configuration: bhk != null ? `${bhk} BHK` : undefined,
    bhk,
    rent,
    salePrice,
    areaSqft,
    url,
    listedBy: 'owner',
    rawText: title,
  };
}

async function readFilterResponse(res: Response): Promise<NobrokerProperty[]> {
  if (!/\/api\/v3\/multi\/property\/(?:RENT|SALE)\/filter/i.test(res.url())) return [];
  if (!res.ok()) return [];
  const json = await res.json().catch(() => null);
  return propertiesFromPayload(json);
}

/**
 * Reload SERP with a response listener so filter API payloads are captured,
 * then map properties to genuine detail URLs.
 */
export async function extractNobrokerListingsFromPage(
  page: Page,
  portal = 'nobroker',
  limit = 40,
): Promise<ResearchListing[]> {
  const bag: NobrokerProperty[] = [];
  const seenIds = new Set<string>();

  const onResponse = async (res: Response) => {
    try {
      const props = await readFilterResponse(res);
      for (const p of props) {
        const id = asString(p.id || p.propertyId || p.nbId) || JSON.stringify(p).slice(0, 80);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        bag.push(p);
      }
    } catch {
      /* ignore parse errors */
    }
  };

  page.on('response', onResponse);
  try {
    // Listener is attached after the first goto in BaseConnector — reload to refill.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(800);
    }
    // One more soft wait for late filter pages.
    await page.waitForTimeout(1_500);
  } finally {
    page.off('response', onResponse);
  }

  const mapped = bag
    .map((p) => mapNobrokerProperty(p, portal))
    .filter((x): x is ResearchListing => Boolean(x));

  const genuine = filterGenuineListingUrls(portal, mapped).slice(0, limit);
  if (genuine.length) return genuine;

  // Last resort: in-page fetch of the same filter the SPA uses (cookies included).
  const fetched = await page
    .evaluate(async () => {
      const loc = window.location;
      const path = loc.pathname || '';
      const mode = /\/property\/sale\//i.test(path) ? 'SALE' : 'RENT';
      const parts = path.split('/').filter(Boolean);
      // /property/rent/mumbai/Andheri_West
      const city = parts[2] || 'mumbai';
      const params = new URLSearchParams(loc.search);
      params.set('pageNo', params.get('pageNo') || '1');
      params.set('city', params.get('city') || city);
      if (!params.has('orderBy')) params.set('orderBy', 'nbRank,desc');
      if (!params.has('sharedAccomodation')) params.set('sharedAccomodation', '0');
      if (!params.has('radius')) params.set('radius', '2');
      const api = `${loc.origin}/api/v3/multi/property/${mode}/filter?${params.toString()}`;
      const res = await fetch(api, { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) return { ok: false, status: res.status, data: null as unknown };
      return { ok: true, status: res.status, data: await res.json() };
    })
    .catch(() => null);

  if (fetched?.ok) {
    const props = propertiesFromPayload(fetched.data);
    return filterGenuineListingUrls(
      portal,
      props
        .map((p) => mapNobrokerProperty(p, portal))
        .filter((x): x is ResearchListing => Boolean(x)),
    ).slice(0, limit);
  }

  return [];
}
