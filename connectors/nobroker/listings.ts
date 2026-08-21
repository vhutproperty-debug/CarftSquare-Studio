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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export function propertiesFromPayload(payload: unknown): NobrokerProperty[] {
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
  // Ignore /filter/nearby empty shells; prefer primary filter.
  if (!/\/api\/v3\/multi\/property\/(?:RENT|SALE)\/filter(?:\?|$)/i.test(res.url())) return [];
  if (/\/filter\/nearby/i.test(res.url())) return [];
  if (!res.ok()) return [];
  // Prefer text→JSON so a failed parse doesn't wedge the body stream oddly.
  const text = await res.text().catch(() => '');
  if (!text) return [];
  try {
    return propertiesFromPayload(JSON.parse(text));
  } catch {
    return [];
  }
}

function mapBag(props: NobrokerProperty[], portal: string, limit: number): ResearchListing[] {
  return filterGenuineListingUrls(
    portal,
    props
      .map((p) => mapNobrokerProperty(p, portal))
      .filter((x): x is ResearchListing => Boolean(x)),
  ).slice(0, limit);
}

/**
 * Capture filter API payloads (reload with listener) and map to detail URLs.
 */
export async function extractNobrokerListingsFromPage(
  page: Page,
  portal = 'nobroker',
  limit = 40,
): Promise<ResearchListing[]> {
  const bag: NobrokerProperty[] = [];
  const seenIds = new Set<string>();

  const ingest = (props: NobrokerProperty[]) => {
    for (const p of props) {
      const id = asString(p.id || p.propertyId || p.nbId) || JSON.stringify(p).slice(0, 80);
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      bag.push(p);
    }
  };

  const onResponse = async (res: Response) => {
    try {
      ingest(await readFilterResponse(res));
    } catch {
      /* ignore */
    }
  };

  page.on('response', onResponse);
  try {
    // Prefer capturing from the current page first (BaseConnector already navigated).
    // Avoid reload+double body reads; recover the filter URL from performance entries.
    for (let i = 0; i < 30 && bag.length === 0; i++) {
      await delay(500);
    }

    if (bag.length === 0) {
      const filterUrls = await page
        .evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((e) => String((e as PerformanceResourceTiming).name || ''))
            .filter((n) => /\/api\/v3\/multi\/property\/(?:RENT|SALE)\/filter\?/i.test(n))
            .filter((n) => !/\/filter\/nearby/i.test(n)),
        )
        .catch(() => [] as string[]);

      for (const api of filterUrls.slice(0, 3)) {
        const fetched = await page
          .evaluate(async (apiUrl) => {
            const res = await fetch(apiUrl, {
              credentials: 'include',
              headers: { Accept: 'application/json' },
            });
            const text = await res.text();
            try {
              return { ok: res.ok, status: res.status, data: JSON.parse(text) };
            } catch {
              return { ok: res.ok, status: res.status, data: null };
            }
          }, api)
          .catch(() => null);
        if (fetched?.data) ingest(propertiesFromPayload(fetched.data));
        if (bag.length) break;
      }
    }

    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 1800);
      await delay(900);
      if (bag.length >= limit) break;
    }
  } finally {
    page.off('response', onResponse);
  }

  if (bag.length) return mapBag(bag, portal, limit);

  // Build searchParam via autosuggest (locality slug alone often yields empty filter).
  const fetched = await page
    .evaluate(async () => {
      const loc = window.location;
      const path = loc.pathname || '';
      const mode = /\/property\/sale\//i.test(path) ? 'SALE' : 'RENT';
      const parts = path.split('/').filter(Boolean);
      const city = (parts[2] || 'mumbai').toLowerCase();
      const localityRaw = decodeURIComponent((parts[3] || '').replace(/_/g, ' ')).trim();
      const params = new URLSearchParams(loc.search);

      let searchParam = params.get('searchParam') || '';
      if (!searchParam && localityRaw) {
        const suggestUrls = [
          `${loc.origin}/api/v1/localities/autosuggest?key=${encodeURIComponent(localityRaw)}&city=${encodeURIComponent(city)}`,
          `${loc.origin}/api/v1/localities/autocomplete?key=${encodeURIComponent(localityRaw)}&city=${encodeURIComponent(city)}`,
          `${loc.origin}/api/v2/localities/autosuggest?showMap=false&term=${encodeURIComponent(localityRaw)}&city=${encodeURIComponent(city)}`,
        ];
        for (const su of suggestUrls) {
          try {
            const sr = await fetch(su, {
              credentials: 'include',
              headers: { Accept: 'application/json' },
            });
            if (!sr.ok) continue;
            const sj = await sr.json();
            const list = Array.isArray(sj)
              ? sj
              : Array.isArray(sj?.data)
                ? sj.data
                : Array.isArray(sj?.predictions)
                  ? sj.predictions
                  : Array.isArray(sj?.localities)
                    ? sj.localities
                    : [];
            const hit = list.find((x: any) => x && (x.placeId || x.place_id || x.id));
            if (!hit) continue;
            const place = {
              lat: hit.lat || hit.latitude || hit.geometry?.location?.lat,
              lon: hit.lon || hit.lng || hit.longitude || hit.geometry?.location?.lng,
              placeId: hit.placeId || hit.place_id || hit.id,
              placeName: hit.placeName || hit.name || hit.description || localityRaw,
              showMap: false,
            };
            if (place.lat != null && place.lon != null && place.placeId) {
              searchParam = btoa(unescape(encodeURIComponent(JSON.stringify([place]))));
              break;
            }
          } catch {
            /* try next suggest URL */
          }
        }
      }

      if (searchParam) params.set('searchParam', searchParam);
      params.set('pageNo', '1');
      params.set('city', params.get('city') || city);
      if (!params.has('orderBy')) params.set('orderBy', 'nbRank,desc');
      if (!params.has('sharedAccomodation')) params.set('sharedAccomodation', '0');
      if (!params.has('radius')) params.set('radius', '2');

      const api = `${loc.origin}/api/v3/multi/property/${mode}/filter?${params.toString()}`;
      const res = await fetch(api, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 400) };
      }
      return {
        ok: res.ok,
        status: res.status,
        api: api.slice(0, 240),
        hasSearchParam: Boolean(searchParam),
        data,
      };
    })
    .catch(() => null);

  if (fetched?.data) {
    const props = propertiesFromPayload(fetched.data);
    if (props.length) return mapBag(props, portal, limit);
  }

  return [];
}
