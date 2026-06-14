const BASE = 'http://localhost:3000';

async function main() {
  const pages = ['/', '/estimate', '/admin', '/blog'];
  const slugs = await (await fetch(`${BASE}/api/blog`)).json().then((d) => (d.posts || []).map((p) => p.slug));
  const results = {};

  const home = await (await fetch(`${BASE}/`)).text();
  results.gtag_count = (home.match(/googletagmanager.com\/gtag\/js/g) || []).length;
  results.gtag_config_count = home.split("gtag('config'").length - 1;
  results.send_page_view_false = home.includes('send_page_view: false');
  results.ga_id_in_html = /googletagmanager.com\/gtag\/js\?id=G-/.test(home);
  results.hydration_bailout_home = home.includes('BAILOUT_TO_CLIENT_SIDE_RENDERING');

  for (const path of pages) {
    const t = await (await fetch(`${BASE}${path}`)).text();
    results[`bailout${path}`] = t.includes('BAILOUT_TO_CLIENT_SIDE_RENDERING');
  }

  for (const slug of slugs) {
    const t = await (await fetch(`${BASE}/blog/${slug}`)).text();
    results[`blog_${slug.slice(0, 20)}`] = {
      bailout: t.includes('BAILOUT_TO_CLIENT_SIDE_RENDERING'),
      cta: /Get (Your )?Free AI Interior Estimate/i.test(t),
      estimate: t.includes('href="/estimate"'),
      leadform: t.includes('Book Free Consultation'),
      whatsapp: t.includes('wa.me'),
      h1: /<h1/i.test(t),
      len: t.length,
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

main();
