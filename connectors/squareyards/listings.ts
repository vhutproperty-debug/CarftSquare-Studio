/**
 * SquareYards listing extraction — prefer API/JSON payloads over nav chrome.
 */

import type { Page, Response } from 'playwright';
import { parseBhk, parseMoney } from '@/connectors/common/listing-parser';
import {
  filterGenuineListingUrls,
  isGenuineListingUrl,
} from '@/connectors/common/listing-url';
import type { ResearchListing } from '@/lib/research/types';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function walkUrls(node: Json, out: string[]) {
  if (node == null) return;
  if (typeof node === 'string') {
    if (/squareyards\.com\/(?:rent|sale|properties)\//i.test(node)) out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkUrls(item, out);
    return;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) walkUrls(v, out);
  }
}

function walkObjects(node: Json, out: Array<Record<string, unknown>>) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walkObjects(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const url = String(obj.url || obj.detailUrl || obj.propertyUrl || obj.seoUrl || '');
  if (url && /squareyards\.com/i.test(url)) out.push(obj);
  for (const v of Object.values(obj)) walkObjects(v as Json, out);
}

export async function extractSquareyardsListingsFromPage(
  page: Page,
  portal = 'squareyards',
  limit = 40,
): Promise<ResearchListing[]> {
  const urls = new Set<string>();
  const objects: Array<Record<string, unknown>> = [];

  const onResponse = async (res: Response) => {
    try {
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) return;
      if (!/squareyards\.com/i.test(res.url())) return;
      if (!res.ok()) return;
      const json = (await res.json().catch(() => null)) as Json;
      if (!json) return;
      const found: string[] = [];
      walkUrls(json, found);
      for (const u of found) urls.add(u.split('#')[0]);
      walkObjects(json, objects);
    } catch {
      /* ignore */
    }
  };

  page.on('response', onResponse);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1600);
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1_500);
  } finally {
    page.off('response', onResponse);
  }

  // Also scrape DOM anchors that already look like detail pages.
  const domUrls = await page
    .evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a as HTMLAnchorElement).href.split('#')[0])
        .filter(Boolean),
    )
    .catch(() => [] as string[]);
  for (const u of domUrls) {
    if (isGenuineListingUrl(portal, u)) urls.add(u);
  }

  const byUrl = new Map<string, ResearchListing>();

  for (const obj of objects) {
    const url = String(obj.url || obj.detailUrl || obj.propertyUrl || obj.seoUrl || '').split(
      '#',
    )[0];
    if (!isGenuineListingUrl(portal, url)) continue;
    const title = String(obj.title || obj.name || obj.projectName || 'Square Yards listing');
    const text = JSON.stringify(obj).slice(0, 500);
    const bhk = parseBhk(title) ?? parseBhk(text);
    const rent = parseMoney(String(obj.rent || obj.price || obj.minPrice || text));
    byUrl.set(url, {
      id: `${portal}:${url}`,
      portal,
      title: title.slice(0, 180),
      locality: String(obj.locality || obj.location || '') || undefined,
      configuration: bhk != null ? `${bhk} BHK` : undefined,
      bhk,
      rent,
      salePrice: /sale/i.test(url) ? rent : undefined,
      areaSqft: Number(obj.area || obj.areaSqft || obj.size) || undefined,
      url,
      rawText: text,
    });
  }

  for (const url of urls) {
    if (byUrl.has(url)) continue;
    if (!isGenuineListingUrl(portal, url)) continue;
    byUrl.set(url, {
      id: `${portal}:${url}`,
      portal,
      title: url.split('/').pop()?.replace(/-/g, ' ') || 'Square Yards listing',
      url,
    });
  }

  return filterGenuineListingUrls(portal, [...byUrl.values()]).slice(0, limit);
}
