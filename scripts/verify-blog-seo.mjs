const BASE = process.argv[2] || 'http://localhost:3000';

async function fetchText(path) {
  const res = await fetch(`${BASE}${path}`);
  return { res, text: await res.text() };
}

async function main() {
  const issues = [];
  const checks = {};

  const blog = await fetchText('/blog');
  checks.blog_status = blog.res.status;
  checks.blog_title = /<title>[^<]+<\/title>/i.test(blog.text);
  checks.blog_canonical = /rel="canonical"/i.test(blog.text);
  checks.blog_og = /property="og:title"/i.test(blog.text);
  checks.blog_h1 = /<h1/i.test(blog.text);

  const slug = 'modular-kitchen-trends-mumbai-2025';
  const article = await fetchText(`/blog/${slug}`);
  checks.article_status = article.res.status;
  checks.article_title = /<title>[^<]+<\/title>/i.test(article.text);
  checks.article_description = /meta name="description"/i.test(article.text);
  checks.article_canonical = /rel="canonical"/i.test(article.text);
  checks.article_og = /property="og:title"/i.test(article.text) && /property="og:description"/i.test(article.text);
  checks.article_schema = /application\/ld\+json/i.test(article.text);
  checks.article_h1 = /<h1/i.test(article.text);
  checks.article_cta = article.text.includes('Get Your Free AI Interior Estimate');
  checks.article_estimate = article.text.includes('href="/estimate"');
  checks.article_leadform = article.text.includes('Book Free Consultation');
  checks.article_cache = article.res.headers.get('cache-control') || '';

  const home = await fetchText('/');
  checks.ga4 = home.text.includes('googletagmanager.com/gtag/js?id=G-DEHJQKSYV6');

  for (const [key, ok] of Object.entries(checks)) {
    if (ok === false || ok === 0) issues.push(key);
  }

  console.log(JSON.stringify({ ok: issues.length === 0, issues, checks }, null, 2));
  process.exit(issues.length ? 1 : 0);
}

main();
