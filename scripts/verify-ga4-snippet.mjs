const GA_ID = 'G-DEHJQKSYV6';
const BASE = process.argv[2] || 'http://localhost:3000';

async function main() {
  const html = await (await fetch(`${BASE}/`)).text();
  const configMatches = (html.match(new RegExp(`gtag\\('config', '${GA_ID}'\\)`, 'g')) || []).length;
  const gtagScriptRefs = (html.match(new RegExp(`googletagmanager\\.com/gtag/js\\?id=${GA_ID}`, 'g')) || []).length;
  const tagLoads = html.includes(`googletagmanager.com/gtag/js?id=${GA_ID}`);
  console.log(JSON.stringify({
    measurement_id: GA_ID,
    gtag_js: tagLoads,
    single_gtag_config: configMatches <= 1,
    no_duplicate_tags: gtagScriptRefs <= 2,
    gtag_script_refs: gtagScriptRefs,
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
