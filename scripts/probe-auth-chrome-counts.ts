async function check(u: string) {
  const r = await fetch(u, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });
  const t = (await r.text()).toLowerCase();
  const patterns = [
    'log out',
    'logout',
    'sign out',
    'signout',
    'edit profile',
    'my profile',
    'get otp',
    'login',
  ];
  const counts: Record<string, number> = {};
  for (const p of patterns) {
    counts[p] = (t.match(new RegExp(p.replace(/ /g, '\\s+'), 'g')) || []).length;
  }
  console.log(JSON.stringify({ u, status: r.status, counts }, null, 2));
}

async function main() {
  await check('https://www.magicbricks.com/');
  await check('https://www.magicbricks.com/?login=true');
  await check('https://www.nobroker.in/users/login');
  await check('https://www.squareyards.com/user/login');
  await check('https://www.99acres.com/');
}

main();
