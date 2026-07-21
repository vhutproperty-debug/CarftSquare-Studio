/**
 * TEMP: authenticated production browser capture for research send flow.
 * Signs bb_admin_session from Mongo admin + AUTH_SECRET, drives Enter vs Submit.
 */
import fs from 'fs';
import path from 'path';
import { chromium, type Request, type Response } from 'playwright';

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

type NetHit = {
  url: string;
  method: string;
  status?: number;
  durationMs?: number;
  requestBody?: string;
  responseBody?: string;
  startedAt: number;
};

const BASE = process.env.TRACE_BASE_URL || 'https://craftsquare.co.in';
const OUT = path.join(process.cwd(), 'tmp', 'research-trace-browser.json');

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
  if (!admin) throw new Error('admin not found');
  const token = signSession(admin);
  await client.close();

  // Verify cookie against production auth
  const statusRes = await fetch(`${BASE}/api/auth/status`, {
    headers: { Cookie: `${SESSION_COOKIE}=${token}` },
  });
  const statusJson = await statusRes.json();
  console.log(
    JSON.stringify({
      tag: 'research-trace',
      step: 'auth_status_probe',
      http: statusRes.status,
      authenticated: statusJson.authenticated,
      researchAccess: statusJson.researchAccess,
      code: statusJson.code,
      userId: statusJson.user?.id || null,
    }),
  );

  if (!statusJson.authenticated || !statusJson.researchAccess) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(
      OUT,
      JSON.stringify({ authProbe: statusJson, runs: [] }, null, 2),
    );
    console.log(
      JSON.stringify({
        tag: 'research-trace',
        step: 'abort_cookie_rejected_by_production',
      }),
    );
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  async function runOnce(mode: 'enter' | 'submit') {
    const page = await context.newPage();
    const consoleLogs: unknown[] = [];
    const network: NetHit[] = [];
    const pending = new Map<Request, NetHit>();

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[research-trace]') || text.includes('research-trace')) {
        consoleLogs.push({ type: msg.type(), text });
      }
    });

    page.on('request', (req) => {
      const url = req.url();
      if (!url.includes('/api/research/ai/sessions')) return;
      const hit: NetHit = {
        url,
        method: req.method(),
        startedAt: Date.now(),
        requestBody: req.postData() || undefined,
      };
      pending.set(req, hit);
      network.push(hit);
    });

    page.on('response', async (res: Response) => {
      const req = res.request();
      const hit = pending.get(req);
      if (!hit) return;
      hit.status = res.status();
      hit.durationMs = Date.now() - hit.startedAt;
      try {
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('application/json')) {
          hit.responseBody = (await res.text()).slice(0, 4000);
        }
      } catch {
        /* ignore */
      }
    });

    await page.goto(`${BASE}/research/research`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    const inPageAuth = await page.evaluate(async () => {
      const res = await fetch('/api/auth/status', { credentials: 'include' });
      const json = await res.json();
      return { http: res.status, json, cookie: document.cookie };
    });
    console.log(
      JSON.stringify({
        tag: 'research-trace',
        step: 'in_page_auth_status',
        mode,
        ...inPageAuth,
      }),
    );

    // If gate shows Try again, click it
    const tryAgain = page.getByRole('button', { name: /try again/i });
    if (await tryAgain.count()) {
      await tryAgain.click();
      await page.waitForTimeout(4000);
    }

    const url = page.url();
    const title = await page.title();
    const textareas = await page.locator('textarea').count();
    const placeholders = await page.locator('textarea').evaluateAll((els) =>
      els.map((e) => (e as HTMLTextAreaElement).placeholder),
    );
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(
      JSON.stringify({
        tag: 'research-trace',
        step: 'page_probe',
        mode,
        url,
        title,
        textareas,
        placeholders,
        bodySnippet: bodyText.slice(0, 800),
      }),
    );

    if (textareas === 0) {
      await page.screenshot({
        path: path.join(process.cwd(), 'tmp', `research-trace-${mode}.png`),
        fullPage: true,
      });
      await page.close();
      return {
        mode,
        consoleLogs,
        network: network.map((n) => ({
          url: n.url,
          method: n.method,
          status: n.status ?? null,
          durationMs: n.durationMs ?? null,
          requestBody: n.requestBody ?? null,
          responseBody: n.responseBody ?? null,
        })),
        uiError: 'no_textarea',
        bodySnippet: bodyText.slice(0, 500),
        inPageAuth,
        aborted: true,
      };
    }

    // Prefer composer placeholder; fall back to first textarea
    let textarea = page.locator('textarea').first();
    const idx = placeholders.findIndex((p) => /analyst/i.test(p || ''));
    if (idx >= 0) textarea = page.locator('textarea').nth(idx);
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    await textarea.click();
    await textarea.fill('Find 2 BHK rentals in Auris Serenity');

    if (mode === 'enter') {
      await textarea.press('Enter');
    } else {
      await page.locator('button[aria-label="Send"]').click();
    }

    // Wait for message POST to finish or timeout
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const msgHit = network.find(
        (n) => n.method === 'POST' && n.url.includes('/message') && n.status != null,
      );
      if (msgHit) break;
      const createOnly =
        network.some((n) => n.method === 'POST' && /\/sessions$/.test(new URL(n.url).pathname)) &&
        Date.now() > deadline - 110000;
      await page.waitForTimeout(500);
      // also break if error banner appears and no in-flight
      const err = await page.locator('p.text-rose-800, p.text-rose-100').first().textContent().catch(() => null);
      if (err && network.every((n) => n.status != null || Date.now() - n.startedAt > 5000)) {
        break;
      }
      void createOnly;
    }

    await page.waitForTimeout(2000);
    const uiError = await page
      .locator('.border-rose-200, .text-rose-800')
      .first()
      .textContent()
      .catch(() => null);
    const finalBodyText = await page.locator('body').innerText();

    await page.close();
    return {
      mode,
      consoleLogs,
      network: network.map((n) => ({
        url: n.url,
        method: n.method,
        status: n.status ?? null,
        durationMs: n.durationMs ?? null,
        requestBody: n.requestBody ?? null,
        responseBody: n.responseBody ?? null,
      })),
      uiError,
      bodySnippet: finalBodyText.slice(0, 500),
    };
  }

  const enterRun = await runOnce('enter');
  // fresh page state for submit — navigate again
  const submitRun = await runOnce('submit');

  const report = {
    base: BASE,
    authProbe: statusJson,
    enterRun,
    submitRun,
    capturedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ tag: 'research-trace', step: 'browser_capture_done', out: OUT }));
  console.log(
    JSON.stringify({
      tag: 'research-trace',
      step: 'enter_network_summary',
      posts: enterRun.network.filter((n) => n.method === 'POST'),
    }),
  );
  console.log(
    JSON.stringify({
      tag: 'research-trace',
      step: 'submit_network_summary',
      posts: submitRun.network.filter((n) => n.method === 'POST'),
    }),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
