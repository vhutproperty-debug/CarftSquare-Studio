import type { Db } from 'mongodb';

const SETTINGS = 'ops_settings';
const POLICY_ID = 'wa_send_policy';

let pausedInProcess = false;

export function isWhatsAppSendingPausedSync(): boolean {
  return pausedInProcess;
}

export async function isWhatsAppSendingPaused(db?: Db): Promise<boolean> {
  if (pausedInProcess) return true;
  if (!db) return false;
  try {
    const doc = await db.collection(SETTINGS).findOne({ id: POLICY_ID });
    pausedInProcess = Boolean(doc && (doc as { paused?: boolean }).paused);
    return pausedInProcess;
  } catch {
    return false;
  }
}

export async function pauseWhatsAppSending(
  db: Db,
  reason: string,
): Promise<void> {
  pausedInProcess = true;
  const now = new Date().toISOString();
  await db.collection(SETTINGS).updateOne(
    { id: POLICY_ID },
    {
      $set: {
        id: POLICY_ID,
        paused: true,
        reason: reason.slice(0, 500),
        pausedAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}
