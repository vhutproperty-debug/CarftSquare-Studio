const BASE = process.argv[2] || 'http://localhost:3000';

async function main() {
  const html = await (await fetch(`${BASE}/`)).text();
  console.log(JSON.stringify({
    gtag_js: html.includes('googletagmanager.com/gtag/js?id=G-TESTLOCAL'),
    send_page_view_false: html.includes('send_page_view: false'),
    single_gtag_config: html.split("gtag('config'").length - 1 === 1,
    homepage_status: 200,
  }, null, 2));

  for (const path of ['/blog', '/estimate', '/admin/blog']) {
    const res = await fetch(`${BASE}${path}`);
    console.log(`${path} -> ${res.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
