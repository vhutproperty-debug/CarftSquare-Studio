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
  const c = new MongoClient(process.env.MONGODB_URI!);
  await c.connect();
  const db = c.db(process.env.DB_NAME || undefined);
  const cols = await db.listCollections().toArray();
  console.log(
    'cols',
    cols.map((x) => x.name).filter((n) => /admin|user|auth/i.test(n)),
  );
  for (const name of cols.map((x) => x.name).filter((n) => /admin/i.test(n))) {
    const sample = await db
      .collection(name)
      .find({})
      .project({ id: 1, email: 1, role: 1, name: 1 })
      .limit(3)
      .toArray();
    console.log(name, JSON.stringify(sample));
  }
  // the research user we know
  const known = '429302ae-4f2c-451b-ae76-fb1315e95de5';
  for (const name of cols.map((x) => x.name)) {
    const hit = await db.collection(name).findOne({
      $or: [{ id: known }, { _id: known as any }],
    });
    if (hit) {
      console.log(
        'found_in',
        name,
        JSON.stringify({
          id: hit.id,
          email: hit.email,
          role: hit.role,
          name: hit.name,
        }),
      );
    }
  }
  await c.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
