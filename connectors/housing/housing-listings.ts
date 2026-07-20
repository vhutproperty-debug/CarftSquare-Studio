import type { Page } from 'playwright';
import { detectListedBy, slugifyProject } from '@/connectors/common/listing-parser';
import type { ResearchListing, ResearchPlanCriteria } from '@/lib/research/types';

/** Genuine Housing rental detail URLs — not locality/category/filter pages.
 * Example: /rent/19337910-1000-sqft-2-bhk-apartment-on-rent-in-malad-west-mumbai
 */
export const HOUSING_LISTING_URL_RE =
  /^https?:\/\/(?:www\.)?housing\.com\/rent\/\d{5,}-\d+(?:\.\d+)?-sqft-[\d.]+-bhk-/i;

const NAV_OR_CATEGORY_RE =
  /\/(?:buy|commercial)\b|-(?:gid|fid)\/|\/projects\/page\/|flats-for-rent-in-[a-z0-9-]+-(?:india|mumbai)-P|\/rent\/\d*bhk-flat-for-rent-in-|flat-for-rent-in-[a-z0-9-]+-AG[a-z0-9]+C\d+$/i;

export type HousingExtractStats = {
  searchUrl: string;
  rawListingCount: number;
  validListingCount: number;
  filteredOutCount: number;
  sampleListingUrls: string[];
};

type RawHousingCard = {
  title: string;
  url: string;
  text: string;
  projectHint: string;
  rentRaw: string;
  areaRaw: string;
  bhkRaw: string;
};

function parseMoney(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/,/g, '');
  const m = cleaned.match(/([\d.]+)\s*(k|lakh|lac|l|cr)?/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const u = (m[2] || '').toLowerCase();
  if (u === 'k') return Math.round(n * 1000);
  if (u.startsWith('l')) return Math.round(n * 100_000);
  if (u.startsWith('cr')) return Math.round(n * 10_000_000);
  return Math.round(n);
}

function parseBhk(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = String(raw).match(/(\d(?:\.\d)?)\s*bhk/i);
  return m ? Number(m[1]) : undefined;
}

function parseAreaSqft(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const m = String(raw).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|sq-ft)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function isGenuineHousingListingUrl(url: string): boolean {
  if (!url || !HOUSING_LISTING_URL_RE.test(url)) return false;
  if (NAV_OR_CATEGORY_RE.test(url)) return false;
  return true;
}

function fieldsFromListingUrl(url: string): {
  bhk?: number;
  areaSqft?: number;
  titleHint?: string;
} {
  const m = url.match(
    /\/rent\/\d{5,}-(\d+(?:\.\d+)?)-sqft-([\d.]+)-bhk-(?:apartment|flat|house|penthouse|villa)?-?(?:on-rent|for-rent)?-in-([^/?#]+)/i,
  );
  if (!m) return {};
  const areaSqft = Math.round(Number(m[1]));
  const bhk = Number(m[2]);
  const locality = (m[3] || '').replace(/-/g, ' ');
  return {
    areaSqft: Number.isFinite(areaSqft) ? areaSqft : undefined,
    bhk: Number.isFinite(bhk) ? bhk : undefined,
    titleHint: Number.isFinite(bhk) ? `${bhk} BHK Flat for rent in ${locality}` : undefined,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeHousingCards(page: Page): Promise<RawHousingCard[]> {
  return page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href*="-sqft-"][href*="-bhk-"]'),
    );
    const seen = new Set<string>();
    const out: Array<{
      title: string;
      url: string;
      text: string;
      projectHint: string;
      rentRaw: string;
      areaRaw: string;
      bhkRaw: string;
    }> = [];

    for (const a of anchors) {
      const href = (a.href || '').split('#')[0];
      if (!href || seen.has(href)) continue;
      if (!/\/rent\/\d{5,}-\d+(?:\.\d+)?-sqft-[\d.]+-bhk-/i.test(href)) continue;

      // Walk up until card text includes a rupee price (Housing nests price outside the <a>).
      let el: HTMLElement | null = a;
      let text = '';
      for (let i = 0; i < 8 && el; i++) {
        const candidate = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (candidate.length > 40) text = candidate.slice(0, 900);
        if (/₹\s*[\d,]/.test(candidate) && candidate.length < 1500) {
          text = candidate.slice(0, 900);
          break;
        }
        el = el.parentElement;
      }

      const heading =
        (el?.querySelector?.('h2, h3, h4')?.textContent ||
          a.getAttribute('title') ||
          a.innerText ||
          ''
        ).replace(/\s+/g, ' ').trim().slice(0, 180);

      // Project name often appears as plain text near the title on Housing cards.
      let projectHint = '';
      const projectMatch = text.match(
        /(?:Sheth\s+)?Auris\s+Serenity|Oberoi\s+Sky\s+City|[A-Z][A-Za-z0-9 &.'-]{3,40}(?=\s*₹|\s*\d+\s*sq)/,
      );
      if (projectMatch) projectHint = projectMatch[0].trim();

      const rentMatch = text.match(/₹\s*[\d,]+(?:\.\d+)?/i);
      const areaMatch = text.match(/[\d,]+\s*(?:sq\.?\s*ft|sqft)/i);
      const bhkMatch = text.match(/\d(?:\.\d)?\s*bhk/i);

      seen.add(href);
      out.push({
        title: heading,
        url: href,
        text,
        projectHint,
        rentRaw: rentMatch?.[0] || '',
        areaRaw: areaMatch?.[0] || '',
        bhkRaw: bhkMatch?.[0] || '',
      });
      if (out.length >= 60) break;
    }
    return out;
  });
}

function toValidListing(
  row: RawHousingCard,
  portal: string,
  criteria?: ResearchPlanCriteria,
): ResearchListing | null {
  if (!isGenuineHousingListingUrl(row.url)) return null;

  const fromUrl = fieldsFromListingUrl(row.url);
  const rent =
    parseMoney(row.rentRaw) ??
    parseMoney(row.text.match(/₹\s*[\d,]+(?:\.\d+)?/i)?.[0]) ??
    parseMoney(row.text.match(/(?:rs\.?|inr)\s*[\d,]+/i)?.[0]);
  const bhk =
    parseBhk(row.bhkRaw) ??
    parseBhk(row.title) ??
    parseBhk(row.text) ??
    fromUrl.bhk;
  const areaSqft =
    parseAreaSqft(row.areaRaw) ?? parseAreaSqft(row.text) ?? fromUrl.areaSqft;
  const title =
    (row.title && row.title.length >= 8 ? row.title : '') ||
    fromUrl.titleHint ||
    '';
  const projectName =
    (criteria?.project && criteria.project.trim()) ||
    (row.projectHint && row.projectHint.length >= 3 ? row.projectHint : '') ||
    '';

  if (!title || !projectName || rent == null || bhk == null || areaSqft == null || !row.url) {
    return null;
  }

  // Optional BHK filter — discard non-matching configs when requested.
  if (criteria?.bhk != null && Math.floor(bhk) !== Math.floor(criteria.bhk)) {
    return null;
  }

  return {
    id: `${portal}:${row.url}`,
    portal,
    title: title.slice(0, 180),
    projectName: projectName.slice(0, 120),
    configuration: `${bhk} BHK`,
    bhk,
    rent,
    areaSqft,
    url: row.url,
    rawText: row.text,
    listedBy: detectListedBy(row.text),
    locality: criteria?.locality,
    extracted: {
      areaSqft,
      source: 'housing-listing-card',
    },
  };
}

async function clickBhkFilterIfPresent(page: Page, bhk: number): Promise<void> {
  // Do NOT navigate to /rent/{n}bhk-flat-for-rent-in-… filter deep links — Housing
  // returns HTTP 406 Security Alert for those URLs from the Browser Worker.
  // Prefer in-page chip click; otherwise leave the project SERP and filter in toValidListing.
  const label = `${bhk} BHK`;
  const clicked = await page
    .evaluate((bhkLabel) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('button, a, label, span, div'));
      for (const el of nodes) {
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t === bhkLabel || t === bhkLabel.replace(' ', '')) {
          // Avoid anchors that deep-link to filtered SERP paths (406 from worker IPs).
          const href = (el as HTMLAnchorElement).href || el.closest('a')?.href || '';
          if (/bhk-flat-for-rent-in-/i.test(href)) continue;
          el.click();
          return true;
        }
      }
      return false;
    }, label)
    .catch(() => false);
  if (clicked) {
    await delay(2_200);
  }
}

/**
 * Resolve Housing project SERP via on-site autocomplete (project search), not query-param landing pages.
 */
async function resolveHousingProjectSerp(
  page: Page,
  criteria: ResearchPlanCriteria,
): Promise<string> {
  const query = [criteria.project, criteria.locality].filter(Boolean).join(' ').trim();
  if (!query) return page.url();

  const txn = criteria.transactionType === 'SALE' ? 'buy' : 'rent';
  const start = `https://housing.com/${txn}`;
  if (!page.url().includes('housing.com')) {
    await page.goto(start, { waitUntil: 'domcontentloaded' });
  } else if (!/housing\.com\/(?:rent|buy)/i.test(page.url()) || /[?&]q=/.test(page.url())) {
    // Query-param landings are marketing shells — restart on /rent.
    await page.goto(start, { waitUntil: 'domcontentloaded' });
  }
  await delay(1_200);

  const inputSelectors = [
    'input[placeholder*="Search" i]',
    'input[placeholder*="Locality" i]',
    'input[placeholder*="project" i]',
    'input[type="search"]',
    'input[name="query"]',
    'input[autocomplete="off"]',
  ];

  let filled = false;
  for (const sel of inputSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) === 0) continue;
    try {
      await loc.click({ timeout: 2_000 });
      await loc.fill('');
      await loc.type(query, { delay: 40 });
      filled = true;
      break;
    } catch {
      /* try next */
    }
  }
  if (!filled) return page.url();

  await delay(1_500);

  const suggestionClicked = await page.evaluate((q) => {
    const needle = q.toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[class*="suggestion"], [class*="Suggestion"], [class*="autosuggest"], [class*="AutoSuggest"], [role="option"], li, a, div, span',
      ),
    );
    for (const el of candidates) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length < 4 || t.length > 120) continue;
      const lower = t.toLowerCase();
      if (!lower.includes(needle.split(' ')[0] || needle)) continue;
      // Prefer project-like rows.
      if (/project|society|apartment|residency|serenity|sky city|tower/i.test(lower) || lower.includes(needle)) {
        el.click();
        return true;
      }
    }
    return false;
  }, query);

  if (!suggestionClicked) {
    await page.keyboard.press('Enter').catch(() => undefined);
  }
  await delay(2_500);

  // If still on a shell, follow any project rent rpid link that matches the query slug.
  if (!/rpid-|\/rent\/\d{5,}-/i.test(page.url())) {
    const rpidLink = await page
      .evaluate((slug) => {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="rpid-"]'));
        const hit = links.find((a) => a.href.toLowerCase().includes(slug) && /\/rent-/i.test(a.href));
        return hit?.href || links.find((a) => /rent-.*-rpid-/i.test(a.href))?.href || '';
      }, slugifyProject(criteria.project || query))
      .catch(() => '');
    if (rpidLink) {
      await page.goto(rpidLink, { waitUntil: 'domcontentloaded' });
      await delay(2_000);
    }
  }

  if (criteria.bhk != null) {
    await clickBhkFilterIfPresent(page, criteria.bhk);
  }

  return page.url();
}

/** Last-resort: discover Housing project rent SERP (rpid) via public HTML search. */
async function discoverProjectRentUrlViaWeb(
  page: Page,
  criteria: ResearchPlanCriteria,
): Promise<string | null> {
  const project = (criteria.project || '').trim();
  if (!project) return null;
  const slug = slugifyProject(project);
  const queries = [
    `site:housing.com "${project}" for rent rpid`,
    `site:housing.com rent-${slug} rpid`,
    `site:housing.com rent sheth ${project} rpid`,
  ];

  for (const query of queries) {
    const ddg = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      await page.goto(ddg, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await delay(1_400);
      const href = await page.evaluate((s) => {
        const unwrap = (url: string) => {
          const m = url.match(/uddg=([^&]+)/);
          if (!m) return url;
          try {
            return decodeURIComponent(m[1]);
          } catch {
            return url;
          }
        };
        const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
        const scored: Array<{ url: string; score: number }> = [];
        for (const a of anchors) {
          const url = unwrap(a.href).split('&')[0];
          if (!/housing\.com\/rent-[^/?#]*rpid-/i.test(url)) continue;
          let score = 1;
          const lower = url.toLowerCase();
          if (lower.includes(s)) score += 5;
          if (lower.includes('sheth-') && s.includes('auris')) score += 3;
          scored.push({ url, score });
        }
        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.url || '';
      }, slug);
      if (href) return href;
    } catch {
      /* try next query */
    }
  }

  // Evidence-based seeds for Mumbai projects whose rent-…-rpid SERPs were verified live.
  // Used only when autocomplete/web discovery fail (datacenter SERPs often block DDG).
  return housingProjectRentSeed(project);
}

/** Verified Housing project rent SERP seeds (rpid pages that render listing cards). */
function housingProjectRentSeed(project: string): string | null {
  const key = project.toLowerCase().replace(/\s+/g, ' ').trim();
  const seeds: Array<{ match: RegExp; url: string }> = [
    {
      match: /auris\s*serenity/i,
      url: 'https://housing.com/rent-sheth-auris-serenity-for-rent-in-malad-west-mumbai-rpid-AG2sAH0',
    },
    {
      match: /oberoi\s*sky\s*city/i,
      url: 'https://housing.com/rent-oberoi-sky-city-for-rent-in-borivali-east-mumbai-rpid-AG6z6iAH0',
    },
  ];
  for (const s of seeds) {
    if (s.match.test(key)) return s.url;
  }
  return null;
}

export async function collectHousingListings(
  page: Page,
  portal: string,
  criteria?: ResearchPlanCriteria,
  limit = 40,
): Promise<{ listings: ResearchListing[]; stats: HousingExtractStats }> {
  let raw = await scrapeHousingCards(page);
  let searchUrl = page.url();

  const onProjectSerp =
    /rpid-/i.test(searchUrl) || /housing\.com\/rent-[a-z0-9-]+-for-rent-in-/i.test(searchUrl);
  const needsProjectResolve = Boolean(criteria?.project) && !onProjectSerp;

  if (needsProjectResolve) {
    // 1) Verified project SERP seed → 2) web discovery → 3) on-site autocomplete
    // Never open BHK filter deep-links (HTTP 406). Filter BHK in toValidListing instead.
    const seed = housingProjectRentSeed(criteria!.project || '');
    const discovered = seed || (await discoverProjectRentUrlViaWeb(page, criteria!));
    if (discovered) {
      await page.goto(discovered, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await delay(2_800);
      await page
        .waitForSelector('a[href*="-sqft-"][href*="-bhk-"]', { timeout: 8_000 })
        .catch(() => undefined);
      searchUrl = page.url();
      raw = await scrapeHousingCards(page).catch(() => []);
    }
    if (raw.filter((r) => isGenuineHousingListingUrl(r.url)).length === 0) {
      searchUrl = await resolveHousingProjectSerp(page, criteria!);
      raw = await scrapeHousingCards(page).catch(() => []);
    }
  } else if (criteria?.bhk != null && onProjectSerp) {
    // Stay on project SERP — BHK applied in toValidListing (filter URLs return 406).
    searchUrl = page.url();
    raw = await scrapeHousingCards(page).catch(() => []);
  }

  const rawListingCount = raw.length;
  const listings: ResearchListing[] = [];
  const seen = new Set<string>();

  // Project fallback from SERP title: "Sheth Auris Serenity Rent - 52 Flats…"
  const pageTitle = await page.title().catch(() => '');
  const projectFromPage = pageTitle.replace(/\s+Rent\b.*$/i, '').trim();
  const criteriaWithProject: ResearchPlanCriteria | undefined = criteria
    ? {
        ...criteria,
        project: criteria.project || projectFromPage || undefined,
      }
    : projectFromPage
      ? ({ project: projectFromPage } as ResearchPlanCriteria)
      : undefined;

  // If card scrape missed rents, enrich from surrounding HTML snippets once.
  if (raw.length > 0 && raw.every((r) => !r.rentRaw)) {
    const enriched = await page
      .evaluate((urls: string[]) => {
        const html = document.documentElement.innerHTML;
        const map: Record<string, string> = {};
        for (const url of urls) {
          const id = url.match(/\/rent\/(\d{5,})-/)?.[1];
          if (!id) continue;
          const idx = html.indexOf(id);
          if (idx < 0) continue;
          const slice = html.slice(Math.max(0, idx - 200), idx + 1200);
          const m = slice.match(/₹\s*[\d,]+/);
          if (m) map[url] = m[0];
        }
        return map;
      }, raw.map((r) => r.url))
      .catch(() => ({} as Record<string, string>));
    for (const row of raw) {
      if (!row.rentRaw && enriched[row.url]) row.rentRaw = enriched[row.url];
    }
  }

  for (const row of raw) {
    if (listings.length >= limit) break;
    const listing = toValidListing(row, portal, criteriaWithProject);
    if (!listing?.url || seen.has(listing.url)) continue;
    seen.add(listing.url);
    listings.push(listing);
  }

  const stats: HousingExtractStats = {
    searchUrl,
    rawListingCount,
    validListingCount: listings.length,
    filteredOutCount: Math.max(0, rawListingCount - listings.length),
    sampleListingUrls: listings.slice(0, 8).map((l) => l.url || ''),
  };

  return { listings, stats };
}

/** Sync URL builder: entry point only — project SERP is resolved in-browser via autocomplete. */
export function buildHousingSearchEntryUrl(criteria: ResearchPlanCriteria): string {
  const txn = criteria.transactionType === 'SALE' ? 'buy' : 'rent';
  const city = encodeURIComponent(criteria.city || 'Mumbai');
  // Do not use ?q= shells — they never render listing cards.
  // Start on /rent; HousingConnector resolves project via autocomplete + rpid SERP.
  return `https://housing.com/${txn}?city=${city}`;
}
