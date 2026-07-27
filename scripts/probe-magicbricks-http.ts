/**
 * Local (non-Railway) MagicBricks HTTP probe for Access Denied evidence.
 *   npx tsx scripts/probe-magicbricks-http.ts
 */
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  try {
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
  } catch {
    /* optional */
  }
}

loadEnvLocal();

async function probe(url: string) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  const text = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    if (/server|akamai|cf-|x-|set-cookie|content-type|cache/i.test(k)) {
      headers[k] = v.slice(0, 160);
    }
  });
  return {
    url,
    status: res.status,
    headers,
    accessDenied: /access denied/i.test(text),
    reference: (text.match(/Reference\s*#[A-Za-z0-9.]+/i) || [])[0] || null,
    title: ((text.match(/<title[^>]*>([^<]+)/i) || [])[1] || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    bodyHit:
      (text.replace(/\s+/g, ' ').match(/Access Denied.{0,160}|Reference\s*#[A-Za-z0-9.]+/i) ||
        [])[0] || null,
  };
}

async function main() {
  const urls = [
    'https://www.magicbricks.com/',
    'https://www.magicbricks.com/userProfile',
    'https://www.magicbricks.com/property-for-rent/residential-real-estate?cityName=Mumbai&keyword=Oberoi%20Sky%20City',
  ];
  const results = [];
  for (const u of urls) results.push(await probe(u));
  const report = {
    probedFrom: 'local-windows',
    workerBase: process.env.RESEARCH_BROWSER_WORKER_URL || null,
    limitation:
      'Does not exercise Railway worker Playwright IP. MagicBricks currently has no encrypted cookies, so worker /jobs/inspect-search cannot run.',
    results,
  };
  const out = path.join(process.cwd(), 'tmp', 'magicbricks-http-probe-local.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
