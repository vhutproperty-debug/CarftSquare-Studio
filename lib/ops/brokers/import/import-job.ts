import { logOpsActivity } from '@/lib/ops/activity/store';
import { importWhatsAppBrokerExport } from '@/lib/ops/brokers/import/import-service';
import {
  deleteImportPayload,
  getImportPayload,
  storeImportPayload,
} from '@/lib/ops/brokers/import/payload-store';
import type { ImportTimings } from '@/lib/ops/brokers/import/timings';
import { validateWhatsAppExportFile } from '@/lib/ops/brokers/import/file-validation';
import { hashFileContent } from '@/lib/ops/brokers/parse/whatsapp-parser';
import {
  createImportBatch,
  ensureBrokerIndexes,
  findBatchByFileHash,
  getDatabase,
  getImportBatch,
  updateImportBatch,
} from '@/lib/ops/brokers/store';
import type { BrokerImportSummary, OpsBrokerImportBatch } from '@/lib/ops/brokers/types';

export type EnqueueImportResult =
  | { mode: 'sync'; summary: BrokerImportSummary }
  | {
      mode: 'async';
      batchId: string;
      batch: OpsBrokerImportBatch;
      alreadyRunning?: boolean;
    };

/**
 * Accept upload, persist payload, return immediately for async processing.
 * Duplicate completed files return sync skip (no background job).
 */
export async function enqueueBrokerImport(input: {
  fileName: string;
  mimeType?: string | null;
  content: string;
  groupName: string;
  uploadedBy: string;
  uploadedByEmail?: string;
  resumeBatchId?: string;
  preloadTimings?: Pick<ImportTimings, 'upload' | 'fileRead'>;
}): Promise<EnqueueImportResult> {
  const validation = validateWhatsAppExportFile({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: Buffer.byteLength(input.content, 'utf8'),
  });
  if (validation.ok === false) {
    throw new Error(validation.error);
  }

  const groupName = input.groupName.trim();
  if (!groupName) throw new Error('WhatsApp group name is required.');

  const db = await getDatabase();
  await ensureBrokerIndexes(db);

  const fileHash = hashFileContent(input.content);
  let batch = input.resumeBatchId
    ? await getImportBatch(db, input.resumeBatchId)
    : await findBatchByFileHash(db, fileHash);

  if (input.resumeBatchId && batch && batch.fileHash !== fileHash) {
    throw new Error('Resume file hash does not match the original batch.');
  }

  if (!batch) {
    batch = await createImportBatch(db, {
      groupName,
      fileName: validation.fileName,
      fileHash,
      uploadedBy: input.uploadedBy,
      uploadedByEmail: input.uploadedByEmail,
    });
  }

  if (
    batch.importStatus === 'COMPLETED'
    || batch.importStatus === 'DUPLICATE_FILE'
    || (batch.stage === 'DONE'
      && (batch.importStatus === 'PARTIAL' || batch.importStatus === 'COMPLETED_WITH_ERRORS')
      && !input.resumeBatchId)
  ) {
    return {
      mode: 'sync',
      summary: {
        batch,
        alreadyProcessed: true,
        messagesParsed: batch.totalMessages,
        listingCandidates: batch.candidateListings,
        createdListings: batch.createdListings,
        updatedListings: batch.updatedListings,
        duplicateListings: batch.duplicateListings,
        failedMessages: batch.failedMessages,
        reviewQueued: batch.reviewQueued,
        unknownProjects: batch.unknownProjects,
        averageConfidence: batch.averageConfidence,
        errors: batch.processingErrors || [],
        stageTimings: {
          ...(input.preloadTimings || {}),
          total: (input.preloadTimings?.upload || 0) + (input.preloadTimings?.fileRead || 0),
        },
      },
    };
  }

  if (batch.importStatus === 'PROCESSING') {
    return {
      mode: 'async',
      batchId: batch.id,
      batch,
      alreadyRunning: true,
    };
  }

  await storeImportPayload({
    batchId: batch.id,
    content: input.content,
    fileName: validation.fileName,
    mimeType: input.mimeType,
    groupName,
    uploadedBy: input.uploadedBy,
    uploadedByEmail: input.uploadedByEmail,
    resumeBatchId: input.resumeBatchId || batch.id,
  });

  await updateImportBatch(db, batch.id, {
    progress: {
      phase: 'queued',
      percent: 1,
      processedCandidates: 0,
      totalCandidates: batch.candidateListings || 0,
      message: 'Queued for background processing',
      updatedAt: new Date().toISOString(),
    },
    stageTimings: input.preloadTimings || {},
  });

  const latest = (await getImportBatch(db, batch.id))!;
  return { mode: 'async', batchId: latest.id, batch: latest };
}

/** Background worker: load payload and run the full import pipeline. */
export async function processEnqueuedImport(
  batchId: string,
  opts?: {
    actorId?: string;
    actorEmail?: string;
    requestUrl?: string;
    preloadTimings?: Pick<ImportTimings, 'upload' | 'fileRead'>;
  },
): Promise<BrokerImportSummary | null> {
  const payload = await getImportPayload(batchId);
  if (!payload) {
    const db = await getDatabase();
    await updateImportBatch(db, batchId, {
      importStatus: 'FAILED',
      failureReason: 'Import payload expired or missing. Re-upload the export file.',
      progress: {
        phase: 'failed',
        percent: 100,
        processedCandidates: 0,
        totalCandidates: 0,
        message: 'Payload missing',
        updatedAt: new Date().toISOString(),
      },
    });
    return null;
  }

  try {
    const summary = await importWhatsAppBrokerExport({
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      content: payload.content,
      groupName: payload.groupName,
      uploadedBy: payload.uploadedBy,
      uploadedByEmail: payload.uploadedByEmail,
      resumeBatchId: payload.resumeBatchId || batchId,
      preloadTimings: opts?.preloadTimings,
    });

    if (opts?.actorId) {
      await logOpsActivity({
        action: summary.alreadyProcessed
          ? 'broker_import_duplicate_skipped'
          : 'broker_import_completed',
        actorId: opts.actorId,
        actorEmail: opts.actorEmail || '',
        resource: 'ops_broker_import_batches',
        details: {
          batchId: summary.batch.id,
          groupName: summary.batch.groupName,
          fileName: summary.batch.fileName,
          messagesParsed: summary.messagesParsed,
          createdListings: summary.createdListings,
          updatedListings: summary.updatedListings,
          alreadyProcessed: summary.alreadyProcessed,
          importStatus: summary.batch.importStatus,
          stageTimings: summary.stageTimings,
          async: true,
        },
      });
    }

    return summary;
  } finally {
    await deleteImportPayload(batchId).catch(() => undefined);
  }
}

export async function getImportJobProgress(batchId: string): Promise<{
  batch: OpsBrokerImportBatch;
  done: boolean;
  summary?: BrokerImportSummary;
} | null> {
  const db = await getDatabase();
  await ensureBrokerIndexes(db);
  const batch = await getImportBatch(db, batchId);
  if (!batch) return null;

  const done = (
    batch.importStatus === 'COMPLETED'
    || batch.importStatus === 'FAILED'
    || batch.importStatus === 'PARTIAL'
    || batch.importStatus === 'COMPLETED_WITH_ERRORS'
    || batch.importStatus === 'DUPLICATE_FILE'
  );

  if (!done) {
    return { batch, done: false };
  }

  return {
    batch,
    done: true,
    summary: {
      batch,
      alreadyProcessed: batch.importStatus === 'DUPLICATE_FILE',
      messagesParsed: batch.totalMessages,
      listingCandidates: batch.candidateListings,
      createdListings: batch.createdListings,
      updatedListings: batch.updatedListings,
      duplicateListings: batch.duplicateListings,
      failedMessages: batch.failedMessages,
      reviewQueued: batch.reviewQueued,
      unknownProjects: batch.unknownProjects,
      averageConfidence: batch.averageConfidence,
      errors: batch.processingErrors || [],
      stageTimings: batch.stageTimings,
      async: true,
    },
  };
}
