const BASE = process.argv[2] || 'http://localhost:3000';

const checks = [];

async function test(name, fn) {
  try {
    const ok = await fn();
    checks.push({ name, ok: Boolean(ok) });
  } catch (e) {
    checks.push({ name, ok: false, error: e.message });
  }
}

await test('Partner page loads', async () => {
  const res = await fetch(`${BASE}/partner`);
  const html = await res.text();
  return res.ok && html.includes('Turn Every Property Deal') && html.includes('Become a CraftSquare Partner');
});

await test('Partner SEO metadata', async () => {
  const html = await fetch(`${BASE}/partner`).then((r) => r.text());
  return html.includes('CraftSquare Partner Network') && html.includes('application/ld+json');
});

await test('Partner login page', async () => {
  const res = await fetch(`${BASE}/partner/login`);
  const text = await res.text();
  return res.ok && text.length > 1000 && (text.includes('Partner Login') || text.includes('Partner Network') || text.includes('Loading'));
});

await test('Trust stats API', async () => {
  const res = await fetch(`${BASE}/api/partner-network/trust-stats`);
  const data = await res.json();
  return res.ok && data.counters?.growingPartnerNetwork != null;
});

await test('Partner quick register API validation', async () => {
  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.status === 400;
});

await test('Partner register API validation', async () => {
  const res = await fetch(`${BASE}/api/partner-network/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.status === 400;
});

await test('Partner dashboard requires auth', async () => {
  const res = await fetch(`${BASE}/api/partner-network/dashboard`);
  return res.status === 401;
});

await test('Admin partner API protected', async () => {
  const res = await fetch(`${BASE}/api/admin/partner-network/dashboard`);
  return res.status === 401;
});

await test('Homepage unchanged', async () => {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  return res.ok && html.includes('CraftSquare') && html.includes('Partner Network');
});

await test('Estimate page unchanged', async () => {
  const res = await fetch(`${BASE}/estimate`);
  return res.ok && (await res.text()).length > 1000;
});

await test('Blog CTA intact', async () => {
  const html = await fetch(`${BASE}/blog/modular-kitchen-trends-mumbai-2025`).then((r) => r.text());
  return html.includes('Get Your Free AI Interior Estimate');
});

await test('GA4 intact', async () => {
  const html = await fetch(`${BASE}/`).then((r) => r.text());
  return html.includes('G-DEHJQKSYV6');
});

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
process.exit(failed.length ? 1 : 0);
