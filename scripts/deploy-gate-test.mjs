/**
 * Deploy gate smoke tests — run against local server (default :3000).
 * Usage: node scripts/deploy-gate-test.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:3000';

const PUBLIC_PAGES = [
  '/',
  '/about',
  '/services/residential-interiors',
  '/gallery',
  '/estimate',
  '/blog',
  '/rental-interiors',
  '/shade-explorer',
  '/admin',
  '/robots.txt',
];

const PUBLIC_APIS = [
  '/api/auth/status',
  '/api/blog',
  '/api/reviews',
];

const PROTECTED_APIS_EXPECT_401 = [
  '/api/admin/leads',
  '/api/admin/dashboard',
  '/api/admin/pricing',
  '/api/admin/rbac/admins',
  '/api/admin/reviews',
];

async function check(name, fn) {
  try {
    await fn();
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}

async function fetchStatus(path, expect = 200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (res.status !== expect) {
      throw new Error(`expected ${expect}, got ${res.status}`);
    }
    const text = await res.text();
    if (path.endsWith('.txt') || path.startsWith('/api/')) return text;
    if (text.length < 500) throw new Error(`suspiciously small HTML (${text.length} bytes)`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const results = [];

for (const path of PUBLIC_PAGES) {
  results.push(await check(`PAGE ${path}`, () => fetchStatus(path, 200)));
}

for (const path of PUBLIC_APIS) {
  results.push(await check(`API ${path}`, async () => {
    const body = await fetchStatus(path, 200);
    JSON.parse(body);
  }));
}

for (const path of PROTECTED_APIS_EXPECT_401) {
  results.push(await check(`PROTECTED ${path} -> 401`, () => fetchStatus(path, 401)));
}

results.push(await check('AUTH status shape', async () => {
  const body = await fetchStatus('/api/auth/status', 200);
  const data = JSON.parse(body);
  if (typeof data.hasAdmin !== 'boolean') throw new Error('missing hasAdmin');
  if (typeof data.authenticated !== 'boolean') throw new Error('missing authenticated');
  if (!('isSuperAdmin' in data)) throw new Error('missing isSuperAdmin');
}));

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ base: BASE, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
