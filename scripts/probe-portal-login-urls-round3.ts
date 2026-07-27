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
  const head = t.slice(0, 80_000);
  console.log(
    JSON.stringify({
      u,
      status: r.status,
      final: r.url,
      title: ((t.match(/<title[^>]*>([^<]+)/i) || [])[1] || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100),
      login: /password|otp|sign in|log in|mobile number|get otp/i.test(head),
      logout: /log\s*out|sign\s*out|my profile|edit profile/i.test(head),
      captcha: /captcha|verifycaptcha|access denied/i.test(`${t}${r.url}`),
    }),
  );
}

const urls = [
  'https://www.magicbricks.com/?login=true',
  'https://www.magicbricks.com/property-for-rent/residential-real-estate?cityName=Mumbai',
  'https://www.99acres.com/',
  'https://www.99acres.com/myprofile',
  'https://www.99acres.com/profile',
  'https://www.99acres.com/owneractivity',
  'https://www.nobroker.in/users/login',
  'https://www.nobroker.in/profile',
  'https://www.squareyards.com/user/login',
  'https://www.squareyards.com/user/dashboard',
  'https://www.squareyards.com/my-account',
];

async function main() {
  for (const u of urls) {
    try {
      await probe(u);
    } catch (e) {
      console.log(JSON.stringify({ u, error: String(e) }));
    }
  }
}

main();
