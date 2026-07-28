/**
 * Drive an active Connect session: fill phone / OTP on the live headed page.
 *
 *   npx tsx scripts/connect-act.ts --session=<id> --action=fill_phone --phone=9022404260
 *   npx tsx scripts/connect-act.ts --session=<id> --action=fill_otp --otp=123456
 *   npx tsx scripts/connect-act.ts --session=<id> --action=snapshot
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const session = arg('session');
  const action = arg('action') || 'snapshot';
  const phone = arg('phone');
  const otp = arg('otp');
  if (!session) {
    console.error('Need --session=<connectSessionId>');
    process.exit(2);
  }

  const base = (
    process.env.RESEARCH_BROWSER_WORKER_URL ||
    'https://unique-endurance-production-57a8.up.railway.app'
  ).replace(/\/$/, '');
  const secret = process.env.RESEARCH_BROWSER_WORKER_SECRET || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-research-worker-secret'] = secret;

  const body: Record<string, string> = { connectSessionId: session, action };
  if (phone) body.phone = phone;
  if (otp) body.otp = otp;
  const captcha = arg('captcha');
  if (captcha) body.captcha = captcha;
  const x = arg('x');
  const y = arg('y');
  const text = arg('text');
  const bodyAny = body as Record<string, unknown>;
  if (x) bodyAny.x = Number(x);
  if (y) bodyAny.y = Number(y);
  if (text) bodyAny.text = text;

  const res = await fetch(`${base}/jobs/connect-act`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* raw */
  }

  // Screenshot: write JPEG to tmp and print the path instead of dumping base64.
  if (
    action === 'page_screenshot' &&
    json &&
    typeof json === 'object' &&
    'imageBase64' in (json as Record<string, unknown>)
  ) {
    const j = json as { imageBase64: string; url?: string; title?: string };
    const outDir = path.join(process.cwd(), 'tmp', 'connect-act');
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${session}-${Date.now()}.jpg`);
    fs.writeFileSync(file, Buffer.from(j.imageBase64, 'base64'));
    console.log(
      JSON.stringify(
        { http: res.status, url: j.url, title: j.title, screenshot: file },
        null,
        2,
      ),
    );
    process.exit(res.ok ? 0 : 1);
  }

  console.log(JSON.stringify({ http: res.status, body: json }, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
