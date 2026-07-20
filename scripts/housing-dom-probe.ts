/**
 * Probe Housing suggest API + listing-card DOM on a known project SERP.
 *   npx tsx scripts/housing-dom-probe.ts
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

async function workerPost(pathname: string, body: Record<string, unknown>) {
  const base = (
    process.env.RESEARCH_BROWSER_WORKER_PUBLIC_URL ||
    process.env.RESEARCH_BROWSER_WORKER_URL ||
    ''
  ).replace(/\/$/, '');
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(process.env.RESEARCH_BROWSER_WORKER_SECRET
        ? { 'x-research-worker-secret': process.env.RESEARCH_BROWSER_WORKER_SECRET }
        : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  // Extend inspect temporarily via direct page evaluation is not available;
  // use known project SERP and dump richer signals by fetching HTML patterns from inspect.
  const projectUrl =
    'https://housing.com/rent-sheth-auris-serenity-for-rent-in-malad-west-mumbai-rpid-AG2sAH0';
  const inspect = await workerPost('/jobs/inspect-search', {
    workspaceId: 'workspace-default',
    portal: 'housing',
    url: projectUrl,
  });
  console.log('=== INSPECT PROJECT SERP ===');
  console.log(JSON.stringify(inspect, null, 2).slice(0, 4000));

  // Probe suggest endpoints from our machine (may 406); also try common paths.
  const queries = ['Auris Serenity', 'Oberoi Sky City', 'auris'];
  const endpoints = [
    (q: string) =>
      `https://housing.com/api/v5/search/suggest?string=${encodeURIComponent(q)}&source=web`,
    (q: string) =>
      `https://housing.com/api/v4/search/suggest?string=${encodeURIComponent(q)}`,
    (q: string) =>
      `https://housing.com/address/addressDataCategorized/Mumbai/${encodeURIComponent(q)}`,
    (q: string) =>
      `https://knox.housing.com/api/v1/web/search/suggest?query=${encodeURIComponent(q)}&serviceType=rent`,
    (q: string) =>
      `https://apis.housing.com/api/v3/new-projects/search?string=${encodeURIComponent(q)}`,
  ];

  for (const q of queries) {
    for (const make of endpoints) {
      const url = make(q);
      try {
        const res = await fetch(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Referer: 'https://housing.com/rent',
          },
        });
        const text = await res.text();
        console.log(`\n=== SUGGEST ${res.status} ${url.slice(0, 120)} ===`);
        console.log(text.slice(0, 800));
      } catch (err) {
        console.log(`FAIL ${url}`, err instanceof Error ? err.message : err);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
