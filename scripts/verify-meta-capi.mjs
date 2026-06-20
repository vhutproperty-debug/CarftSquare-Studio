#!/usr/bin/env node
/**
 * Verify Meta CAPI configuration on production.
 * Usage: node scripts/verify-meta-capi.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] || 'https://craftsquare.co.in').replace(/\/$/, '');

async function main() {
  console.log(`\nMeta CAPI verification — ${baseUrl}\n`);

  const healthRes = await fetch(`${baseUrl}/api/meta/capi`);
  const health = await healthRes.json().catch(() => ({}));
  console.log('Health:', JSON.stringify(health, null, 2));

  if (!health?.capi?.accessTokenConfigured) {
    console.log('\n❌ META_ACCESS_TOKEN is not configured on the server.');
    console.log('   Run: node scripts/setup-meta-capi-vercel.mjs <your_token>');
    console.log('   Or see audit report for Meta UI steps.\n');
    process.exit(1);
  }

  const payload = {
    eventName: 'Lead',
    eventId: crypto.randomUUID(),
    eventSourceUrl: `${baseUrl}/free-interior-consultation`,
    customData: {
      content_name: 'ai_interior_consultant',
      landing_page: '/free-interior-consultation',
      verification: true,
    },
    userData: { phone: '7304242604', firstName: 'Verify', lastName: 'Script' },
  };

  const capiRes = await fetch(`${baseUrl}/api/meta/capi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const capi = await capiRes.json().catch(() => ({}));
  console.log(`\nCAPI POST (${capiRes.status}):`, JSON.stringify(capi, null, 2));

  if (capi.ok) {
    console.log('\n✅ Server CAPI accepted the Lead event.');
    if (health?.capi?.testEventCodeConfigured) {
      console.log('   Check Meta Events Manager → Test Events for this event.');
    }
    process.exit(0);
  }

  if (capi.skipped) {
    console.log('\n⚠️  CAPI skipped — redeploy after adding env vars.');
    process.exit(1);
  }

  console.log('\n❌ CAPI failed:', capi.error || 'unknown error');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
