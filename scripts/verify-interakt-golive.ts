import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  // @ts-expect-error JS module
  const { getDb } = await import('../lib/mongodb.js');
  const db = await getDb();

  const event = await db.collection('interakt_webhook_events').findOne(
    { id: '2a1aa3d9-11a0-4bbd-9a60-e3e811fc52d8' },
    {
      projection: {
        _id: 0,
        id: 1,
        eventType: 1,
        processingStatus: 1,
        providerMessageId: 1,
        signatureValid: 1,
      },
    },
  );

  const conv = await db.collection('interakt_conversations').findOne(
    { normalizedPhone: '9876543210', businessWaNumber: '917304242604' },
    {
      projection: {
        _id: 0,
        id: 1,
        matchStatus: 1,
        normalizedPhone: 1,
        businessWaNumber: 1,
        unreadCount: 1,
        primaryLink: 1,
        candidateLinks: 1,
      },
    },
  );

  const msgs = await db
    .collection('interakt_messages')
    .find(
      { normalizedPhone: '9876543210' },
      {
        projection: {
          _id: 0,
          id: 1,
          providerMessageId: 1,
          conversationId: 1,
          direction: 1,
          status: 1,
        },
      },
    )
    .toArray();

  const indexes: Record<string, unknown[]> = {};
  for (const c of ['interakt_webhook_events', 'interakt_conversations', 'interakt_messages']) {
    indexes[c] = (await db.collection(c).indexes()).map((i: { name: string; key: unknown; unique?: boolean }) => ({
      name: i.name,
      key: i.key,
      unique: Boolean(i.unique),
    }));
  }

  const prospectCount = await db.collection('ops_prospects').countDocuments({ phone: '9876543210' });
  const leadCount = await db.collection('leads').countDocuments({ phone: '9876543210' });

  console.log(JSON.stringify({ event, conv, msgs, prospectCount, leadCount, indexes }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
