/**
 * TEMP: reproduce Enter vs Submit on production; log Cookie header presence only.
 */
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const BASE = 'https://craftsquare.co.in';

async function main() {
  const { MongoClient } = await import('mongodb');
  const { signSession } = await import('../lib/auth/session.js');
  const { SESSION_COOKIE } = await import('../lib/auth/session-constants.js');
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db(process.env.DB_NAME || undefined);
  const admin = await db.collection('admins').findOne({
    id: '429302ae-4f2c-451b-ae76-fb1315e95de5',
  });
  const token = signSession(admin!);
  await client.close();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      domain: 'craftsquare.co.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  async function run(mode: 'enter' | 'submit') {
    const page = await context.newPage();
    const hits: Array<Record<string, unknown>> = [];

    page.on('request', (req) => {
      const url = req.url();
      if (!url.includes('/api/research/ai/sessions')) return;
      if (req.method() !== 'POST') return;
      const cookie = req.headers()['cookie'] || '';
      hits.push({
        phase: 'request',
        url: url.replace(BASE, ''),
        method: req.method(),
        hasCookieHeader: Boolean(cookie),
        cookieNames: cookie
          .split(';')
          .map((p) => p.trim().split('=')[0])
          .filter(Boolean),
        hasSessionCookie: cookie.includes(SESSION_COOKIE + '='),
        body: req.postData(),
        at: Date.now(),
      });
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (!url.includes('/api/research/ai/sessions')) return;
      if (res.request().method() !== 'POST') return;
      let body = '';
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      hits.push({
        phase: 'response',
        url: url.replace(BASE, ''),
        status: res.status(),
        body,
        at: Date.now(),
      });
    });

    await page.goto(`${BASE}/research/research`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const tryAgain = page.getByRole('button', { name: /try again/i });
    if (await tryAgain.count()) {
      await tryAgain.click();
      await page.waitForTimeout(4000);
    }
    const ta = page.locator('textarea').first();
    await ta.waitFor({ state: 'visible', timeout: 20000 });
    await ta.fill('Find 2 BHK rentals in Auris Serenity');
    if (mode === 'enter') await ta.press('Enter');
    else await page.locator('button[aria-label="Send"]').click();

    // wait for message response
    const start = Date.now();
    while (Date.now() - start < 90000) {
      const done = hits.some(
        (h) =>
          h.phase === 'response' &&
          String(h.url).includes('/message') &&
          h.status != null,
      );
      if (done) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    const uiError = await page.locator('.border-rose-200').first().textContent().catch(() => null);
    await page.close();
    return { mode, hits, uiError };
  }

  const enter1 = await run('enter');
  const enter2 = await run('enter');
  const submit1 = await run('submit');

  const out = { enter1, enter2, submit1, at: new Date().toISOString() };
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/research-trace-enter-repro.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
