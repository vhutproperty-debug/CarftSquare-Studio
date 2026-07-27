import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  for (const url of [
    'https://www.nobroker.in/#signup-login',
    'https://www.nobroker.in/users/login#signup-login',
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4_000);
    const info = await page.evaluate(() => ({
      url: location.href,
      phone: Boolean(document.querySelector('#signUp-phoneNumber')),
      text: (document.body?.innerText || '').includes('Enter Mobile Number'),
    }));
    console.log(JSON.stringify({ requested: url, ...info }, null, 2));
    await ctx.close();
  }
  await browser.close();
})();
