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
  const base = (process.env.RESEARCH_BROWSER_WORKER_URL || '').replace(/\/$/, '');
  const secret = process.env.RESEARCH_BROWSER_WORKER_SECRET || '';
  const urls = [
    'https://housing.com/rent-sheth-auris-serenity-for-rent-in-malad-west-mumbai-rpid-AG2sAH0',
    'https://housing.com/rent/2bhk-flat-for-rent-in-sheth-auris-serenity-AG2sAH0C4',
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
      title?: string;
      sampleHrefs?: string[];
      bodyTextSample?: string;
      htmlLength?: number;
    };
    const list = (j.sampleHrefs || []).filter((h) => /\/rent\/\d{5,}-/.test(h));
    console.log(
      JSON.stringify(
        {
          url,
          http: j.httpStatus,
          sec: j.securityChallenge,
          title: j.title,
          html: j.htmlLength,
          list: list.length,
          sample: list.slice(0, 5),
          hrefs: (j.sampleHrefs || []).slice(0, 10),
          body: (j.bodyTextSample || '').slice(0, 280),
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
