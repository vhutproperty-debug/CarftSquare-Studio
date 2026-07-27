/**
 * Deeper login URL discovery for portals that still 404.
 *   npx tsx scripts/probe-portal-login-urls-round2.ts
 */
async function probe(u: string) {
  const r = await fetch(u, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      accept: 'text/html',
    },
  });
  const t = await r.text();
  const title = ((t.match(/<title[^>]*>([^<]+)/i) || [])[1] || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const finalUrl = r.url;
  return {
    u,
    status: r.status,
    finalUrl,
    title,
    hasLoginForm: /password|otp|sign.?in|login|mobile number|enter mobile/i.test(t.slice(0, 50_000)),
    accessDenied: /access denied|reference\s*#/i.test(t),
  };
}

async function main() {
  const urls = [
    'https://accounts.magicbricks.com/',
    'https://accounts.magicbricks.com/login',
    'https://accounts.magicbricks.com/userauth/login',
    'https://www.99acres.com/login-lrfv',
    'https://www.99acres.com/login',
    'https://www.99acres.com/userlogin',
    'https://authn.99acres.com/login',
    'https://www.99acres.com/do/Login.html',
    'https://www.99acres.com/property/loginpage',
    'https://www.nobroker.in/',
    'https://www.nobroker.in/users/login',
    'https://www.nobroker.in/nb/user/login',
    'https://www.squareyards.com/user/login',
    'https://www.squareyards.com/dashboard',
  ];
  const results = [];
  for (const u of urls) {
    try {
      results.push(await probe(u));
    } catch (e) {
      results.push({ u, error: e instanceof Error ? e.message : String(e) });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
