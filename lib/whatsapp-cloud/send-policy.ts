import type { Db } from 'mongodb';
import {
  evaluateWabaRestriction,
  readSendOverride,
  readWabaRestrictionFromGraph,
  type WabaHealthSnapshot,
} from '@/lib/whatsapp-cloud/waba-restriction';

const SETTINGS = 'ops_settings';
const POLICY_ID = 'wa_send_policy';
const CACHE_MS = 60_000;

let pausedInProcess = false;

type CachedRead = {
  at: number;
  snapshot: WabaHealthSnapshot | null;
  error: string | null;
};

let cachedRead: CachedRead | null = null;

export type WhatsAppSendDecision = {
  blocked: boolean;
  reason: string;
  override: 'blocked' | 'unrestricted';
  graphRestricted: boolean;
  accountReviewStatus: string | null;
  businessVerificationStatus: string | null;
  canSendMessage: string | null;
  localPause: boolean;
};

export type WabaReader = () => Promise<{ snapshot: WabaHealthSnapshot | null; error: string | null }>;

export function clearWhatsAppSendCache(): void {
  cachedRead = null;
}

export function isWhatsAppSendingPausedSync(): boolean {
  if (pausedInProcess) return true;
  if (readSendOverride() !== 'unrestricted') return true;
  return false;
}

async function readGraph(reader?: WabaReader): Promise<{ snapshot: WabaHealthSnapshot | null; error: string | null }> {
  if (!reader && cachedRead && Date.now() - cachedRead.at < CACHE_MS) {
    return { snapshot: cachedRead.snapshot, error: cachedRead.error };
  }
  const read = reader ? await reader() : await readWabaRestrictionFromGraph();
  if (!reader) cachedRead = { at: Date.now(), snapshot: read.snapshot, error: read.error };
  return read;
}

export async function getWhatsAppSendDecision(db?: Db, reader?: WabaReader): Promise<WhatsAppSendDecision> {
  let localPause = pausedInProcess;
  let localReason = '';
  if (db) {
    try {
      const doc = await db.collection(SETTINGS).findOne({ id: POLICY_ID });
      if (doc && (doc as { paused?: boolean }).paused) {
        localPause = true;
        pausedInProcess = true;
        localReason = String((doc as { reason?: string }).reason || 'WhatsApp sending is paused.');
      }
    } catch {
      localPause = localPause || false;
    }
  }
  const graph = await readGraph(reader);
  const evaluated = evaluateWabaRestriction({
    override: readSendOverride(),
    snapshot: graph.snapshot,
    graphError: graph.error,
  });
  if (localPause) {
    return {
      ...evaluated,
      blocked: true,
      localPause: true,
      reason: localReason || evaluated.reason || 'WhatsApp sending is paused because the account is restricted.',
    };
  }
  return { ...evaluated, localPause: false };
}

export async function isWhatsAppSendingPaused(db?: Db, reader?: WabaReader): Promise<boolean> {
  const decision = await getWhatsAppSendDecision(db, reader);
  return decision.blocked;
}

export async function pauseWhatsAppSending(
  db: Db,
  reason: string,
): Promise<void> {
  pausedInProcess = true;
  clearWhatsAppSendCache();
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
