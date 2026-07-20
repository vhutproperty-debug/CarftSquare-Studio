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

async function main() {
  const base = (
    process.env.RESEARCH_BROWSER_WORKER_PUBLIC_URL ||
    process.env.RESEARCH_BROWSER_WORKER_URL ||
    ''
  ).replace(/\/$/, '');
  const secret = process.env.RESEARCH_BROWSER_WORKER_SECRET || '';
  if (!base) throw new Error('Missing RESEARCH_BROWSER_WORKER_URL');
  console.log('workerBase', base);
  const urls = [
    'https://housing.com/rent/2bhk-flat-for-rent-in-sheth-auris-serenity-AG2sAH0C4',
    'https://housing.com/rent-oberoi-sky-city-for-rent-in-borivali-east-mumbai-rpid-AG6z6iAH0',
    'https://housing.com/rent-sheth-auris-serenity-for-rent-in-mumbai',
    'https://housing.com/rent-auris-serenity-for-rent-in-malad-west-mumbai-rpid-AG2sAH0',
  ];
  for (const url of urls) {
    const res = await fetch(`${base}/jobs/inspect-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-research-worker-secret': secret } : {}),
      },
      body: JSON.stringify({ workspaceId: 'workspace-default', portal: 'housing', url }),
    });
    const j = (await res.json()) as {
      httpStatus?: number;
      securityChallenge?: boolean;
      sampleHrefs?: string[];
      finalUrl?: string;
      title?: string;
      error?: string;
    };
    const list = (j.sampleHrefs || []).filter((h) => /\/rent\/\d{5,}-/.test(h));
    console.log(
      JSON.stringify(
        {
          req: url,
          http: j.httpStatus,
          sec: j.securityChallenge,
          list: list.length,
          final: j.finalUrl,
          title: j.title,
          error: j.error,
          sample: list.slice(0, 2),
        },
        null,
        2,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
