/**
 * Deep DOM probe: NoBroker modal open + SquareYards login fields.
 */
import fs from 'fs/promises';
import path from 'path';
import { chromium, type Page } from 'playwright';

async function dumpLoginSignals(page: Page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 800);
    const anchors = Array.from(document.querySelectorAll('a,button,[role="button"]'))
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        href: (el as HTMLAnchorElement).href || '',
        id: el.id || '',
        cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
      }))
      .filter((x) => /log\s*in|sign\s*up|sign\s*in|otp|continue|get otp/i.test(x.text))
      .slice(0, 30);
    const inputs = Array.from(document.querySelectorAll('input')).map((el) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      aria: el.getAttribute('aria-label') || '',
    }));
    return { title: document.title, url: location.href, text, anchors, inputs: inputs.slice(0, 40) };
  });
}

async function tryClickLogin(page: Page) {
  const candidates = [
    'text=Log in',
    'text=Login',
    'text=Sign up',
    'text=Sign Up',
    'a:has-text("Log in")',
    'a:has-text("Login")',
    'button:has-text("Log in")',
    '[data-testid*="login" i]',
    '#login',
    '.login',
  ];
  const tried: string[] = [];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    const count = await loc.count().catch(() => 0);
    if (!count) continue;
    tried.push(sel);
    try {
      await loc.click({ timeout: 2_000 });
      await page.waitForTimeout(2_000);
      const signals = await dumpLoginSignals(page);
      if (
        /otp|phone|mobile|password|enter your/i.test(signals.text) ||
        signals.inputs.some((i) => /tel|phone|mobile|otp|password/i.test(`${i.type} ${i.name} ${i.id} ${i.placeholder}`))
      ) {
        return { opened: true, selector: sel, tried, signals };
      }
    } catch {
      /* try next */
    }
  }
  return { opened: false, selector: null, tried, signals: await dumpLoginSignals(page) };
}

async function main() {
  const out = path.join(process.cwd(), 'tmp', 'connect-debug', `${Date.now()}-nb-sy-modal`);
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  // NoBroker: homepage then open modal
  {
    const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('https://www.nobroker.in/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: path.join(out, 'nobroker-home.jpg'), type: 'jpeg', quality: 60 });
    const before = await dumpLoginSignals(page);
    const click = await tryClickLogin(page);
    await page.screenshot({ path: path.join(out, 'nobroker-after-click.jpg'), type: 'jpeg', quality: 60 });
    await fs.writeFile(
      path.join(out, 'nobroker-modal.json'),
      JSON.stringify({ before, click }, null, 2),
    );
    console.log('NOBROKER', JSON.stringify({
      opened: click.opened,
      selector: click.selector,
      url: click.signals.url,
      otpLike: /otp|phone|mobile/i.test(click.signals.text),
      inputs: click.signals.inputs.slice(0, 12),
      anchors: click.signals.anchors.slice(0, 12),
    }, null, 2));
    await ctx.close();
  }

  // SquareYards dedicated login
  {
    const ctx = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('https://www.squareyards.com/user/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(4_000);
    await page.screenshot({ path: path.join(out, 'squareyards-login.jpg'), type: 'jpeg', quality: 60 });
    const signals = await dumpLoginSignals(page);
    await fs.writeFile(path.join(out, 'squareyards-login.json'), JSON.stringify(signals, null, 2));
    console.log('SQUAREYARDS', JSON.stringify({
      url: signals.url,
      title: signals.title,
      otpLike: /otp|phone|mobile|password|email/i.test(signals.text),
      inputs: signals.inputs.slice(0, 20),
      anchors: signals.anchors.slice(0, 15),
      text: signals.text.slice(0, 400),
    }, null, 2));
    await ctx.close();
  }

  await browser.close();
  console.log('OUT', out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
