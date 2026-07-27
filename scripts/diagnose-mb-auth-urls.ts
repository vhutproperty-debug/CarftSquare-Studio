import { chromium } from 'playwright';

const urls = [
  'https://accounts.magicbricks.com/userauth/login',
  'https://www.magicbricks.com/bricks/User-Registration1',
];

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  for (const url of urls) {
    const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await ctx.newPage();
    let status: number | null = null;
    let error: string | null = null;
    try {
      const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      status = r?.status() ?? null;
      await page.waitForTimeout(4_000);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const title = await page.title().catch(() => '');
    const body = await page
      .evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400))
      .catch(() => '');
    const t = `${body} ${title}`.toLowerCase();
    console.log(
      JSON.stringify(
        {
          url,
          status,
          error,
          title,
          finalUrl: page.url(),
          accessDenied: /access denied|security alert|akamai/.test(t),
          otp: /otp|enter mobile|mobile no|phone number|verification code/.test(t),
          body: body.slice(0, 280),
        },
        null,
        2,
      ),
    );
    await ctx.close();
  }
  await browser.close();
})();
