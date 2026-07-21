/**
 * Local auth-path timing probe (before/after patch behavior).
 * Does not hit production. Uses .env.local Mongo + signed session.
 */
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvLocal();

async function main() {
  const { MongoClient } = await import('mongodb');
  const { signSession } = await import('../lib/auth/session.js');
  const { SESSION_COOKIE } = await import('../lib/auth/session-constants.js');
  const { authorizeRequest } = await import('../lib/auth/require-admin-api');
  const { isMongoReady, getDb } = await import('../lib/mongodb.js');

  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db(process.env.DB_NAME || undefined);
  const admin = await db.collection('admins').findOne({
    id: '429302ae-4f2c-451b-ae76-fb1315e95de5',
  });
  await client.close();
  if (!admin) throw new Error('admin missing');

  const token = signSession(admin);
  const makeReq = () =>
    new Request('http://localhost/api/research/ai/sessions/x/message', {
      method: 'POST',
      headers: {
        Cookie: `${SESSION_COOKIE}=${token}`,
        'Content-Type': 'application/json',
      },
    });

  // Cold-ish: first authorize after process start (getDb may connect + indexes)
  console.log(JSON.stringify({ tag: 'auth-timing', step: 'before_first', mongoReady: isMongoReady() }));
  const t1 = Date.now();
  const r1 = await authorizeRequest(makeReq(), { permission: 'research', action: 'edit' });
  const firstMs = Date.now() - t1;
  console.log(
    JSON.stringify({
      tag: 'auth-timing',
      step: 'first_authorize',
      ms: firstMs,
      ok: r1.ok,
      status: r1.ok ? 200 : r1.status,
      mongoReady: isMongoReady(),
    }),
  );

  // Warm: cached connection, no migration on hot path
  const warmSamples: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const t = Date.now();
    const r = await authorizeRequest(makeReq(), { permission: 'research', action: 'edit' });
    warmSamples.push(Date.now() - t);
    if (!r.ok) {
      console.log(JSON.stringify({ tag: 'auth-timing', step: 'warm_fail', status: r.status, i }));
    }
  }

  // Prove getDb reuse
  const tDb = Date.now();
  await getDb();
  const getDbWarmMs = Date.now() - tDb;

  // No-cookie path
  const tNo = Date.now();
  const rNo = await authorizeRequest(
    new Request('http://localhost/api/research/ai/sessions/x/message', { method: 'POST' }),
    { permission: 'research', action: 'edit' },
  );

  const out = {
    firstAuthorizeMs: firstMs,
    firstOk: r1.ok,
    warmAuthorizeMs: warmSamples,
    warmAvgMs: Math.round(warmSamples.reduce((a, b) => a + b, 0) / warmSamples.length),
    getDbWarmMs,
    noCookieStatus: rNo.ok ? 200 : rNo.status,
    noCookieMs: Date.now() - tNo,
  };
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/auth-timing-local.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ tag: 'auth-timing', step: 'summary', ...out }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
