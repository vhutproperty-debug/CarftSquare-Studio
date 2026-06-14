const urls = ['http://localhost:3000/', 'https://craftsquare.studio/'];

for (const u of urls) {
  const t = await fetch(u).then((r) => r.text());
  const preload = (t.match(/rel="preload"[^>]*googletagmanager/g) || []).length;
  const scriptSrc = (t.match(/<script[^>]*src="[^"]*googletagmanager[^"]*"/g) || []).length;
  const gtagAll = (t.match(/googletagmanager\.com\/gtag\/js/g) || []).length;
  const config = t.split("gtag('config'").length - 1;
  const gaId = t.match(/googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/);
  console.log({
    url: u,
    preload,
    scriptSrc,
    gtagAll,
    config,
    gaId: gaId?.[1] || null,
    send_page_view_false: t.includes('send_page_view: false'),
    bailout: t.includes('BAILOUT_TO_CLIENT_SIDE_RENDERING'),
    hasBlogCta: /Get (Your )?Free AI Interior Estimate/i.test(t),
  });
}
