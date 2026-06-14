const BASE = process.argv[2] || 'http://localhost:3000';
const paths = ['/blog', '/blog/modular-kitchen-trends-mumbai-2025', '/api/blog'];

async function measure(path) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  const ms = Math.round(performance.now() - start);
  const cacheControl = res.headers.get('cache-control') || '';
  const hasLazyImg = text.includes('loading="lazy"') || text.includes('loading=\\"lazy\\"');
  const hasPriority = text.includes('priority') || text.includes('fetchpriority="high"');
  return {
    path,
    status: res.status,
    ms,
    bytes: text.length,
    cacheControl: cacheControl.slice(0, 60),
    hasLazyImg,
    hasPriority,
    ssg: !text.includes('BAILOUT_TO_CLIENT_SIDE_RENDERING') || text.length > 10000,
  };
}

const results = [];
for (const path of paths) {
  results.push(await measure(path));
  await new Promise((r) => setTimeout(r, 200));
}

console.log(JSON.stringify({ base: BASE, results }, null, 2));
