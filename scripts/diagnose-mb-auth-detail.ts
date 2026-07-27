import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

(async () => {
  const out = path.join(process.cwd(), 'tmp', 'connect-nav-probe', 'mb-auth');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await ctx.newPage();
  const url = 'https://accounts.magicbricks.com/userauth/login';
  const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: path.join(out, 'accounts-login-t5.jpg'), type: 'jpeg', quality: 70 });
  const body = await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').trim());
  const html = await page.content();
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input,button')).map((el) => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type || '',
      name: (el as HTMLInputElement).name || '',
      id: el.id || '',
      text: (el.textContent || '').trim().slice(0, 80),
      placeholder: (el as HTMLInputElement).placeholder || '',
    })),
  );
  console.log(
    JSON.stringify(
      {
        status: r?.status(),
        title: await page.title(),
        finalUrl: page.url(),
        bodyHasMobile: /mobile|phone|otp|login/i.test(body),
        bodySlice: body.slice(0, 600),
        inputs: inputs.slice(0, 40),
        htmlHasLogin: /enter mobile|mobile no|otp|password/i.test(html),
      },
      null,
      2,
    ),
  );
  await browser.close();
})();
