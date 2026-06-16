/**
 * One-time backfill: recompute registrationStatus + profileCompletionPercent on all partners.
 * Usage: node scripts/backfill-partner-registration-status.mjs
 */
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

const STEP2_KEYS = [
  'operatingAreas', 'dealType', 'projectsCovered', 'dealsPerMonth', 'city', 'state', 'whatsapp',
];

function filled(value) {
  return String(value ?? '').trim().length > 0;
}

function calculateProfileCompletion(partner) {
  if (!filled(partner.fullName) || !filled(partner.mobile)) return 0;
  const step2Filled = STEP2_KEYS.filter((key) => filled(partner[key])).length;
  if (step2Filled === 0) return 25;
  const raw = 25 + Math.round((step2Filled / STEP2_KEYS.length) * 75);
  if (raw <= 37) return 50;
  if (raw <= 62) return 75;
  return 100;
}

function deriveRegistrationStatus(partner) {
  return calculateProfileCompletion(partner) >= 100 ? 'complete' : 'incomplete';
}

loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db();
  const collection = db.collection('partner_network_partners');
  const partners = await collection.find({}).toArray();

  let updated = 0;
  const summary = { complete: 0, incomplete: 0 };

  for (const partner of partners) {
    const profileCompletionPercent = calculateProfileCompletion(partner);
    const registrationStatus = deriveRegistrationStatus(partner);
    summary[registrationStatus] += 1;

    if (
      partner.registrationStatus !== registrationStatus
      || partner.profileCompletionPercent !== profileCompletionPercent
    ) {
      await collection.updateOne(
        { id: partner.id },
        {
          $set: {
            registrationStatus,
            profileCompletionPercent,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      updated += 1;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    scanned: partners.length,
    updated,
    summary,
  }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(1);
} finally {
  await client.close();
}
