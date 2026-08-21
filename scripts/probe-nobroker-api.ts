/**
 * Capture NoBroker listing API payloads + late DOM links.
 * Run: npx tsx scripts/probe-nobroker-api.ts
 */
import { chromium } from 'playwright';
import { isGenuineListingUrl } from '../connectors/common/listing-url';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const apiHits: Array<{ url: string; count?: number; sample?: unknown }> = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (!/nobroker\.in\/api\//i.test(u)) return;
    if (!/property|filter|list|search|rent/i.test(u)) return;
    try {
      const json = await res.json().catch(() => null);
      if (!json) return;
      const data = json.data || json;
      const list = data?.data || data?.properties || data?.propertyList || data?.list || [];
      const arr = Array.isArray(list) ? list : Array.isArray(data) ? data : [];
      if (!arr.length && !/filter|property/i.test(u)) return;
      apiHits.push({
        url: u.slice(0, 180),
        count: arr.length,
        sample: arr[0]
          ? {
              id: arr[0].id || arr[0].propertyId || arr[0].nbId,
              detailUrl: arr[0].detailUrl || arr[0].url || arr[0].pageUrl || arr[0].shortUrl,
              title: arr[0].title || arr[0].propertyTitle || arr[0].society,
              keys: Object.keys(arr[0]).slice(0, 25),
            }
          : Object.keys(data || {}).slice(0, 20),
      });
    } catch {
      /* ignore */
    }
  });

  const url =
    'https://www.nobroker.in/property/rent/mumbai/Andheri_West?type=BHK2&sharedAccomodation=0&orderBy=nbRank,desc&radius=2';
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined);
  await page.waitForTimeout(10_000);
  // scroll to trigger lazy load
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(1_200);
  }

  const hrefs = await page.evaluate(() =>
    [...new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href))],
  );
  const propertyHrefs = hrefs.filter((h) => /\/property\//i.test(h));
  console.log('final', page.url());
  console.log('apiHits', JSON.stringify(apiHits.slice(0, 8), null, 2));
  console.log('propertyHrefs', propertyHrefs.length);
  for (const h of propertyHrefs.slice(0, 25)) {
    console.log(`${isGenuineListingUrl('nobroker', h) ? 'ACCEPT' : 'reject'} ${h}`);
  }
  console.log(
    'card-ish',
    await page.evaluate(() =>
      document.querySelectorAll('[id^="property-"], article, .card, [class*="property"]').length,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
