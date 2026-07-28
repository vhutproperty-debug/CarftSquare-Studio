import fs from 'fs';
import https from 'https';

const report = JSON.parse(fs.readFileSync('tmp/research-smoke/liveview-probe.json', 'utf8'));
const url = report.liveViewUrl;
const u = new URL(url);
const viewId = u.pathname.split('/')[2];

function get(pathOrUrl, cookie) {
  const full = pathOrUrl.startsWith('http') ? pathOrUrl : `https://${u.host}${pathOrUrl}`;
  return new Promise((resolve, reject) => {
    https
      .get(full, { headers: { Cookie: cookie || '', Accept: '*/*' } }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
            ctype: res.headers['content-type'],
          }),
        );
      })
      .on('error', reject);
  });
}

async function main() {
  const cookieHeader = await new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const c = (res.headers['set-cookie'] || []).map((x) => x.split(';')[0]).join('; ');
        res.resume();
        resolve(c);
      })
      .on('error', reject);
  });

  const page = await get(url, cookieHeader);
  const scripts = [...page.body.matchAll(/src=["']([^"']+)["']/g)].map((m) => m[1]);
  const results = [];
  for (const src of scripts.slice(0, 15)) {
    if (/^https?:/i.test(src)) {
      results.push({ src, status: 'external' });
      continue;
    }
    const rel = src.replace(/^\.\//, '').replace(/^\//, '');
    const assetUrl = `https://${u.host}/remote/${viewId}/${rel}`;
    const r = await get(assetUrl, cookieHeader);
    results.push({ src, status: r.status, ctype: r.ctype, bytes: r.body.length });
  }

  for (const rel of ['vnc_lite.html', 'app/ui.js', 'core/rfb.js', 'vendor/pako/lib/utils/common.js']) {
    const assetUrl = `https://${u.host}/remote/${viewId}/${rel}`;
    const r = await get(assetUrl, cookieHeader);
    results.push({ src: rel, status: r.status, ctype: r.ctype, bytes: r.body.length, probe: true });
  }

  console.log(
    JSON.stringify(
      {
        htmlStatus: page.status,
        cookieSet: Boolean(cookieHeader),
        scriptCount: scripts.length,
        scripts: scripts.slice(0, 15),
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
