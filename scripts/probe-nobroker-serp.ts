/**
 * Probe NoBroker SERP for real listing href / data-id patterns.
 * Run: npx tsx scripts/probe-nobroker-serp.ts
 */
import { chromium } from 'playwright';
import { isGenuineListingUrl } from '../connectors/common/listing-url';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const url =
    'https://www.nobroker.in/property/rent/mumbai/Andheri_West?type=BHK2&sharedAccomodation=0&orderBy=nbRank,desc&radius=2';
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(8_000);
  console.log('final', page.url());
  console.log('title', await page.title());

  const info = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll('a[href*="/property/"]')).map(
      (a) => (a as HTMLAnchorElement).href,
    );
    const articles = Array.from(document.querySelectorAll('article, #listContainer > div, [itemtype*="Apartment"]'))
      .slice(0, 15)
      .map((el) => ({
        tag: el.tagName,
        id: el.id,
        dataId: el.getAttribute('data-id') || el.getAttribute('data-property-id'),
        cls: String(el.className || '').slice(0, 100),
        link: (el.querySelector('a[href]') as HTMLAnchorElement | null)?.href || '',
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      }));
    return {
      hrefSample: [...new Set(hrefs)].slice(0, 40),
      articles,
      bodyStart: (document.body?.innerText || '').slice(0, 400),
    };
  });

  console.log('hrefs:');
  for (const h of info.hrefSample) {
    console.log(`${isGenuineListingUrl('nobroker', h) ? 'ACCEPT' : 'reject'} ${h}`);
  }
  console.log('articles:', JSON.stringify(info.articles, null, 2));
  console.log('bodyStart:', info.bodyStart);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
