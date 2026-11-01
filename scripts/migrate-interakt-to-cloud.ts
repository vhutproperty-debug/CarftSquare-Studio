/**
 * Copy historical Interakt collections into WhatsApp Cloud collections.
 * Does not delete the source collections.
 *
 *   npx tsx scripts/migrate-interakt-to-cloud.ts --dry-run
 *   npx tsx scripts/migrate-interakt-to-cloud.ts
 */
import { getDb } from '@/lib/mongodb';

const dryRun = process.argv.includes('--dry-run');

const PAIRS: Array<[string, string]> = [
  ['interakt_conversations', 'wa_conversations'],
  ['interakt_messages', 'wa_messages'],
  ['interakt_webhook_events', 'wa_webhook_events'],
  ['interakt_message_attempts', 'wa_message_attempts'],
  ['interakt_delivery_retries', 'wa_delivery_retries'],
  ['interakt_delivery_transitions', 'wa_delivery_transitions'],
  ['interakt_ai_insights', 'wa_ai_insights'],
];

async function main() {
  const db = await getDb();
  for (const [source, target] of PAIRS) {
    const rows = await db.collection(source).find({}).toArray();
    let copied = 0;
    for (const row of rows) {
      const { _id, ...rest } = row as { _id?: unknown; provider?: string };
      const doc = {
        ...rest,
        provider: 'interakt_legacy',
        migratedFrom: source,
      };
      if (dryRun) {
        copied += 1;
        continue;
      }
      const key = (rest as { id?: string }).id
        ? { id: (rest as { id?: string }).id }
        : { migratedLegacyId: String(_id) };
      await db.collection(target).updateOne(
        key,
        { $setOnInsert: { ...doc, ...(key.migratedLegacyId ? { id: key.migratedLegacyId } : {}) } },
        { upsert: true },
      );
      copied += 1;
    }
    console.log(JSON.stringify({ source, target, rows: rows.length, copied, dryRun }));
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
