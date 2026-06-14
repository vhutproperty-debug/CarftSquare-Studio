const BASE = process.argv[2] || 'http://localhost:3000';

const SLUGS = [
  'modular-kitchen-trends-mumbai-2025',
  'rental-interior-roi-mumbai',
  'small-space-interior-design-tips',
  'wardrobe-planning-guide',
];

const REQUIRED = [
  'Get Your Free AI Interior Estimate',
  'Get your personalized AI-powered interior cost estimate in under 60 seconds.',
  'Talk to an Interior Designer on WhatsApp',
  'Book Free Consultation',
  'href="/estimate"',
  'wa.me',
];

async function verifySlug(slug) {
  const res = await fetch(`${BASE}/blog/${slug}`);
  const html = await res.text();
  const missing = REQUIRED.filter((text) => !html.includes(text));
  return { slug, status: res.status, ok: res.ok && missing.length === 0, missing };
}

async function main() {
  const listRes = await fetch(`${BASE}/api/blog`);
  const list = await listRes.json();
  const apiSlugs = (list.posts || []).map((p) => p.slug);
  const slugs = apiSlugs.length ? apiSlugs : SLUGS;

  const results = [];
  for (const slug of slugs) {
    results.push(await verifySlug(slug));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ checked: results.length, passed: results.length - failed.length, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
