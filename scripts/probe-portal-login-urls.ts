/**
 * Probe candidate login URLs for research portals.
 *   npx tsx scripts/probe-portal-login-urls.ts
 */
import fs from 'fs';
import path from 'path';

async function probe(u: string) {
  const r = await fetch(u, {
    redirect: 'manual',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html',
    },
  });
  const loc = r.headers.get('location');
  let title = '';
  let snippet = '';
  if (![301, 302, 303, 307, 308].includes(r.status)) {
    const t = await r.text();
    title = ((t.match(/<title[^>]*>([^<]+)/i) || [])[1] || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    snippet = t.replace(/\s+/g, ' ').slice(0, 220);
  }
  return {
    u,
    status: r.status,
    loc,
    title,
    looksAuth:
      /login|sign.?in|otp|password|my account|profile|dashboard/i.test(`${title} ${snippet}`) &&
      !/error report|not found|404/i.test(`${title} ${snippet}`),
    looksError: /error report|not found|404|access denied/i.test(`${title} ${snippet}`),
  };
}

async function main() {
  const urls = [
    'https://www.magicbricks.com/userProfile',
    'https://www.magicbricks.com/mblogin',
    'https://www.magicbricks.com/login',
    'https://www.magicbricks.com/bricks/login.html',
    'https://accounts.magicbricks.com/',
    'https://www.magicbricks.com/mymagicbricks/dashboard',
    'https://www.magicbricks.com/mymagicbricks/myProfile',
    'https://www.magicbricks.com/bricks/loginForm.html',
    'https://www.99acres.com/myaccount',
    'https://www.99acres.com/loginpage',
    'https://www.99acres.com/load/Login',
    'https://www.nobroker.in/profile',
    'https://www.nobroker.in/signin',
    'https://www.nobroker.in/login',
    'https://www.squareyards.com/account',
    'https://www.squareyards.com/login',
    'https://www.squareyards.com/user/login',
    'https://housing.com/user-profile',
  ];
  const results = [];
  for (const u of urls) {
    try {
      results.push(await probe(u));
    } catch (e) {
      results.push({ u, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const out = path.join(process.cwd(), 'tmp', 'portal-login-url-probe.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
