/**
 * Probe public SERP pages for candidate listing hrefs (no auth).
 * Helps tune isGenuineListingUrl allow patterns.
 *
 * Run: npx tsx scripts/probe-listing-hrefs.ts
 */
import { chromium } from 'playwright';
import { isGenuineListingUrl } from '../connectors/common/listing-url';

const PAGES = [
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/rent/mumbai?searchParam=Andheri%20West&type=2BHK',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/search?q=Andheri%20West&city=Mumbai&propertyType=Apartment&transaction=Rent',
  },
];

async function probe(portal: string, url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(5_000);
    const hrefs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean),
    );
    const unique = [...new Set(hrefs)];
    console.log(`\n=== ${portal} (${unique.length} unique hrefs) title=${await page.title()} ===`);
    console.log(`page=${page.url()}`);

    const propertyish = unique.filter((h) =>
      /property|\/rent|\/sale|flat|apartment|bhk|ppid|spid|pid/i.test(h),
    );
    console.log(`propertyish=${propertyish.length}`);
    for (const h of propertyish.slice(0, 40)) {
      const ok = isGenuineListingUrl(portal, h);
      console.log(`${ok ? 'ACCEPT' : 'reject'} ${h}`);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  for (const p of PAGES) {
    try {
      await probe(p.portal, p.url);
    } catch (e) {
      console.error(p.portal, e);
    }
  }
}

main();
