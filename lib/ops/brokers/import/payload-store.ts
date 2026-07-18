import type { Db } from 'mongodb';
import { ensureBrokerIndexes, getDatabase } from '@/lib/ops/brokers/store';

const COLLECTION = 'ops_broker_import_payloads';

let payloadIndexesEnsured = false;

async function ensurePayloadIndexes(db: Db): Promise<void> {
  if (payloadIndexesEnsured) return;
  await db.collection(COLLECTION).createIndex({ batchId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  payloadIndexesEnsured = true;
}

/** Temporary storage of export text for async job processing (TTL 2h). */
export async function storeImportPayload(input: {
  batchId: string;
  content: string;
  fileName: string;
  mimeType?: string | null;
  groupName: string;
  uploadedBy: string;
  uploadedByEmail?: string;
  resumeBatchId?: string;
}): Promise<void> {
  const db = await getDatabase();
  await ensureBrokerIndexes(db);
  await ensurePayloadIndexes(db);
  const now = Date.now();
  await db.collection(COLLECTION).updateOne(
    { batchId: input.batchId },
    {
      $set: {
        batchId: input.batchId,
        content: input.content,
        fileName: input.fileName,
        mimeType: input.mimeType || null,
        groupName: input.groupName,
        uploadedBy: input.uploadedBy,
        uploadedByEmail: input.uploadedByEmail,
        resumeBatchId: input.resumeBatchId,
        createdAt: new Date(now),
        expiresAt: new Date(now + 2 * 60 * 60 * 1000),
      },
    },
    { upsert: true },
  );
}

export async function getImportPayload(batchId: string): Promise<{
  content: string;
  fileName: string;
  mimeType?: string | null;
  groupName: string;
  uploadedBy: string;
  uploadedByEmail?: string;
  resumeBatchId?: string;
} | null> {
  const db = await getDatabase();
  await ensurePayloadIndexes(db);
  const doc = await db.collection(COLLECTION).findOne({ batchId });
  if (!doc?.content) return null;
  return {
    content: String(doc.content),
    fileName: String(doc.fileName || 'export.txt'),
    mimeType: doc.mimeType as string | null | undefined,
    groupName: String(doc.groupName || ''),
    uploadedBy: String(doc.uploadedBy || ''),
    uploadedByEmail: doc.uploadedByEmail as string | undefined,
    resumeBatchId: doc.resumeBatchId as string | undefined,
  };
}

export async function deleteImportPayload(batchId: string): Promise<void> {
  const db = await getDatabase();
  await db.collection(COLLECTION).deleteOne({ batchId });
}
