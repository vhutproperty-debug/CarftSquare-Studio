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

  const convCorrect = await db.collection('interakt_conversations').findOne(
    { normalizedPhone: '9811122233', businessWaNumber: '919867525258' },
    { projection: { _id: 0, id: 1, businessWaNumber: 1, normalizedPhone: 1, matchStatus: 1 } },
  );
  const convWrong = await db.collection('interakt_conversations').findOne(
    { normalizedPhone: '9811122233', businessWaNumber: '917304242604' },
    { projection: { _id: 0, id: 1, businessWaNumber: 1 } },
  );
  const msg = await db.collection('interakt_messages').findOne(
    { normalizedPhone: '9811122233' },
    { projection: { _id: 0, id: 1, businessWaNumber: 1, conversationId: 1, status: 1 } },
  );

  console.log(JSON.stringify({
    expectedBusinessWa: '919867525258',
    conversationWithCorrectNumber: convCorrect,
    conversationWithOldIncorrectNumber: convWrong,
    message: msg,
    consistent: Boolean(
      convCorrect
      && convCorrect.businessWaNumber === '919867525258'
      && msg
      && msg.businessWaNumber === '919867525258'
      && !convWrong
    ),
  }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
