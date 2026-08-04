import type { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import type { ResearchListing } from '@/lib/research/types';

export type ListedByKind = 'owner' | 'broker' | 'builder' | 'unknown';

export function parseMoney(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = raw.replace(/,/g, '').match(/([\d.]+)\s*(k|lakh|lac|l|cr)?/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const u = (m[2] || '').toLowerCase();
  if (u === 'k') return Math.round(n * 1000);
  if (u.startsWith('l')) return Math.round(n * 100_000);
  if (u.startsWith('cr')) return Math.round(n * 10_000_000);
  return Math.round(n);
}

export function parseBhk(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d(?:\.\d)?)\s*bhk/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Detect poster type from listing card / detail text.
 *
 * Reliable phrases seen across Housing / MagicBricks / 99acres search cards:
 *   "Posted by Owner", "Posted by Dealer", "Posted by Builder", "Posted by Agent"
 * NoBroker is owner-direct by product model but cards often omit an explicit label —
 * we only mark owner when the text says so (never guess from portal key alone).
 * Square Yards signals are less consistent in card text — often returns unknown.
 */
export function detectListedBy(raw?: string | null): ListedByKind {
  const text = String(raw || '').toLowerCase().replace(/\s+/g, ' ');
  if (!text.trim()) return 'unknown';

  // Prefer explicit "posted by …" phrases (portal search cards).
  if (
    /posted\s+by\s+owner|by\s+owner|owner\s+property|seller\s*:\s*owner|listed\s+by\s+owner/.test(
      text,
    )
  ) {
    return 'owner';
  }
  if (
    /posted\s+by\s+builder|by\s+builder|listed\s+by\s+builder|seller\s*:\s*builder/.test(text)
  ) {
    return 'builder';
  }
  if (
    /posted\s+by\s+(?:dealer|agent|broker)|by\s+(?:dealer|agent|broker)|listed\s+by\s+(?:dealer|agent|broker)|seller\s*:\s*(?:dealer|agent|broker)/.test(
      text,
    )
  ) {
    return 'broker';
  }

  // Weaker single-token signals — only when not conflicting.
  const hasOwner = /\bowner\b/.test(text);
  const hasBroker = /\b(?:dealer|broker|agent)\b/.test(text);
  const hasBuilder = /\bbuilder\b/.test(text);
  if (hasOwner && !hasBroker && !hasBuilder) return 'owner';
  if (hasBuilder && !hasOwner && !hasBroker) return 'builder';
  if (hasBroker && !hasOwner) return 'broker';

  return 'unknown';
}

/**
 * Portal-agnostic listing harvest from the current search results page.
 * Prefer portal-specific parsers when selectors are stable; this is the fallback.
 */
export async function collectGenericListings(
  page: Page,
  portal: string,
  limit = 40,
): Promise<ResearchListing[]> {
  const rows = await page.evaluate((max) => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[href*="property"], a[href*="/rent"], a[href*="/buy"], a[href*="flat"], a[href*="apartment"], a[href*="resale"]',
      ),
    );
    const seen = new Set<string>();
    const out: Array<{
      title: string;
      url: string;
      text: string;
    }> = [];

    for (const a of anchors) {
      const href = a.href || '';
      if (!href || href.startsWith('javascript:') || seen.has(href)) continue;
      const title = (a.getAttribute('title') || a.innerText || '').replace(/\s+/g, ' ').trim();
      if (title.length < 8) continue;
      const card =
        a.closest('article, li, [class*="card"], [class*="Card"], [class*="tuple"], [data-id]')
        || a.parentElement;
      const text = (card?.textContent || title).replace(/\s+/g, ' ').trim().slice(0, 500);
      seen.add(href);
      out.push({ title: title.slice(0, 180), url: href, text });
      if (out.length >= max) break;
    }
    return out;
  }, limit);

  return rows.map((row) => {
    const rent = parseMoney(row.text.match(/(?:₹|rs\.?)\s*[\d,.]+(?:\s*(?:k|lakh|lac|l))?/i)?.[0]);
    const bhk = parseBhk(row.text);
    const listedBy = detectListedBy(row.text);
    return {
      id: `${portal}:${row.url || uuidv4()}`,
      portal,
      title: row.title,
      configuration: bhk != null ? `${bhk} BHK` : undefined,
      bhk,
      rent,
      url: row.url,
      rawText: row.text,
      listedBy,
    } satisfies ResearchListing;
  });
}

export function slugifyProject(value?: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
