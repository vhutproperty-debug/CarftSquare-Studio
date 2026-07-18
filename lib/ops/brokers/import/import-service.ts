import { v4 as uuidv4 } from 'uuid';
import { BROKER_IMPORT_CONFIG, REVIEW_CONFIG } from '@/lib/ops/brokers/config';
import {
  computeConfidenceBreakdown,
  scoreDedupeConfidence,
} from '@/lib/ops/brokers/confidence';
import { detectListingCandidate } from '@/lib/ops/brokers/detect/listing-detector';
import { dedupeKeyFromExtraction } from '@/lib/ops/brokers/dedupe/dedupe-key';
import {
  bumpBrokerInventoryStats,
  resolveOrCreateBroker,
} from '@/lib/ops/brokers/directory';
import { extractListingFields } from '@/lib/ops/brokers/extract/listing-extractor';
import { validateWhatsAppExportFile } from '@/lib/ops/brokers/import/file-validation';
import { daysSince } from '@/lib/ops/brokers/freshness';
import {
  loadAliasMap,
  trackUnknownProject,
} from '@/lib/ops/brokers/normalize/project-aliases';
import { normalizeExtractedListing, normalizePhone } from '@/lib/ops/brokers/normalize/normalize';
import { hashFileContent, hashMessage, parseWhatsAppExport } from '@/lib/ops/brokers/parse/whatsapp-parser';
import { decideReviewRouting, enqueueReviewItem } from '@/lib/ops/brokers/review';
import {
  buildInventoryRecord,
  claimImportBatch,
  createImportBatch,
  createInventoryRecord,
  findBatchByFileHash,
  findInventoryByDedupeKey,
  getDatabase,
  getImportBatch,
  insertRawMessages,
  listCandidateMessagesForBatch,
  refreshInventoryRecord,
  updateImportBatch,
} from '@/lib/ops/brokers/store';
import type {
  BrokerImportSummary,
  OpsBrokerImportBatch,
  OpsBrokerInventory,
  OpsBrokerRawMessage,
} from '@/lib/ops/brokers/types';

function summaryFromBatch(
  batch: OpsBrokerImportBatch,
  opts?: { alreadyProcessed?: boolean; resumed?: boolean },
): BrokerImportSummary {
  return {
    batch,
    alreadyProcessed: opts?.alreadyProcessed ?? false,
    resumed: opts?.resumed,
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
  };
}

async function finalizeBatch(
  batchId: string,
  patch: Partial<OpsBrokerImportBatch>,
  startedAt: string,
  opts?: { markDone?: boolean },
): Promise<OpsBrokerImportBatch> {
  const finishedAt = new Date().toISOString();
  const processingDurationMs = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
  );
  const updated = await updateImportBatch(await getDatabase(), batchId, {
    ...patch,
    finishedAt,
    processingDurationMs,
    ...(opts?.markDone === false ? {} : { stage: 'DONE' as const }),
  });
  return updated!;
}

type ImportPlan =
  | { action: 'skip'; batch: OpsBrokerImportBatch }
  | { action: 'run'; batch: OpsBrokerImportBatch; resumed: boolean; needRawPersist: boolean };

function planImport(batch: OpsBrokerImportBatch | null, forceResume: boolean): ImportPlan | null {
  if (!batch) return null;

  if (batch.importStatus === 'COMPLETED' || batch.importStatus === 'DUPLICATE_FILE') {
    return { action: 'skip', batch };
  }

  // Successfully finished inventory pass (including review-only leftovers) — do not reprocess
  if (
    !forceResume
    && (batch.importStatus === 'PARTIAL' || batch.importStatus === 'COMPLETED_WITH_ERRORS')
    && batch.stage === 'DONE'
  ) {
    return { action: 'skip', batch };
  }

  const stage = batch.stage || 'PENDING';
  const needRawPersist = stage === 'PENDING' || !stage;
  const canResumeInventory = stage === 'RAW_PERSISTED' || stage === 'INVENTORY';
  const canResumeFailed =
    batch.importStatus === 'FAILED'
    || batch.importStatus === 'PARTIAL'
    || batch.importStatus === 'COMPLETED_WITH_ERRORS'
    || batch.importStatus === 'PROCESSING'
    || batch.importStatus === 'PENDING';

  if (canResumeFailed && (needRawPersist || canResumeInventory || forceResume)) {
    return {
      action: 'run',
      batch,
      resumed: batch.importStatus !== 'PENDING' || stage !== 'PENDING',
      // When force-resuming a DONE/INVENTORY batch, skip raw re-parse
      needRawPersist,
    };
  }

  return { action: 'skip', batch };
}

async function processCandidateWindow(input: {
  batch: OpsBrokerImportBatch;
  candidates: OpsBrokerRawMessage[];
  startIndex: number;
  aliasMap: Map<string, string>;
  counters: {
    createdListings: number;
    updatedListings: number;
    duplicateListings: number;
    failedMessages: number;
    reviewQueued: number;
    unknownProjects: number;
    confidenceSum: number;
    confidenceCount: number;
    listingsExtracted: number;
  };
  errors: string[];
}): Promise<number> {
  const db = await getDatabase();
  const { batch, candidates, aliasMap, counters, errors } = input;
  let i = input.startIndex;

  while (i < candidates.length) {
    const raw = candidates[i];
    try {
      const extracted = normalizeExtractedListing(
        extractListingFields(raw.rawMessage),
        raw.rawMessage,
        aliasMap,
      );

      const brokerPhone = normalizePhone(raw.senderPhone);
      const brokerName = raw.senderName;
      const confidence = computeConfidenceBreakdown({
        parseStatus: raw.parseStatus,
        rawMessage: raw.rawMessage,
        hasTimestamp: Boolean(raw.messageTimestamp),
        hasSender: Boolean(brokerName || brokerPhone),
        extracted,
        brokerPhone,
      });

      counters.confidenceSum += confidence.overallConfidence;
      counters.confidenceCount += 1;
      counters.listingsExtracted += 1;

      if (!extracted.projectMapped && extracted.projectName) {
        await trackUnknownProject(db, {
          projectName: extracted.projectName,
          groupName: batch.groupName,
          batchId: batch.id,
          messageId: raw.id,
        });
        counters.unknownProjects += 1;
      }

      const broker = await resolveOrCreateBroker(db, {
        senderName: brokerName,
        senderPhone: brokerPhone,
        groupName: batch.groupName,
        seenAt: raw.messageTimestamp || new Date().toISOString(),
      });

      const dedupeKey = dedupeKeyFromExtraction(extracted, {
        brokerName: broker?.canonicalName || brokerName,
        brokerPhone: brokerPhone || broker?.phones[0],
      });

      const existing = await findInventoryByDedupeKey(db, dedupeKey);
      const dedupeConfidence = existing
        ? scoreDedupeConfidence({
            dedupeKey,
            existing,
            proposed: extracted,
          })
        : 100;

      const hasConflictingRent = Boolean(
        existing?.rent
          && extracted.rent
          && Math.abs(existing.rent - extracted.rent) / existing.rent > REVIEW_CONFIG.rentConflictRatio,
      );
      const hasConflictingConfiguration = Boolean(
        existing?.bhk != null
          && extracted.bhk != null
          && existing.bhk !== extracted.bhk,
      );

      const routing = decideReviewRouting({
        confidence,
        dedupeConfidence,
        existing,
        projectMapped: extracted.projectMapped,
        hasConflictingRent,
        hasConflictingConfiguration,
        malformed: false,
      });

      const seenAt = raw.messageTimestamp || new Date().toISOString();
      const proposedPartial: Partial<OpsBrokerInventory> = {
        ...extracted,
        brokerId: broker?.id,
        brokerName: broker?.canonicalName || brokerName,
        brokerPhone: brokerPhone,
        originalSenderName: brokerName,
        originalSenderPhone: brokerPhone,
        groupName: batch.groupName,
        extractedText: {
          rentText: extracted.rentText,
          salePriceText: extracted.salePriceText,
          depositText: extracted.depositText,
          areaText: extracted.areaText,
          configurationText: extracted.configurationText,
        },
        overallConfidence: confidence.overallConfidence,
        parserConfidence: confidence.parserConfidence,
        projectConfidence: confidence.projectConfidence,
        configurationConfidence: confidence.configurationConfidence,
        priceConfidence: confidence.priceConfidence,
        phoneConfidence: confidence.phoneConfidence,
        sourceType: 'BROKER_GROUP',
      };

      if (routing.action === 'review') {
        const queued = await enqueueReviewItem(db, {
          reasons: routing.reasons,
          batchId: batch.id,
          groupName: batch.groupName,
          rawMessageId: raw.id,
          dedupeKey,
          existingInventoryId: existing?.id,
          proposed: proposedPartial,
          confidence,
          dedupeConfidence,
        });
        if (queued.created) counters.reviewQueued += 1;
        i += 1;
        continue;
      }

      // Idempotent: already linked this raw message to inventory
      if (existing?.sourceMessageIds?.includes(raw.id)) {
        i += 1;
        continue;
      }

      if (existing && routing.action === 'auto_merge') {
        const before = {
          rent: existing.rent,
          salePrice: existing.salePrice,
          configuration: existing.configuration,
          furnishing: existing.furnishing,
        };
        await refreshInventoryRecord(db, existing, {
          sourceMessageId: raw.id,
          lastImportBatchId: batch.id,
          lastSeenAt: seenAt,
          lastMessageAt: seenAt,
          ...proposedPartial,
        });
        const pureRepost =
          before.rent === extracted.rent
          && before.salePrice === extracted.salePrice
          && before.configuration === extracted.configuration
          && before.furnishing === extracted.furnishing;
        if (pureRepost) counters.duplicateListings += 1;
        else counters.updatedListings += 1;
        if (broker) {
          await bumpBrokerInventoryStats(db, broker.id, {
            created: false,
            freshnessDays: daysSince(seenAt),
          });
        }
      } else {
        try {
          await createInventoryRecord(
            db,
            buildInventoryRecord({
              extracted: proposedPartial,
              dedupeKey,
              batchId: batch.id,
              messageId: raw.id,
              groupName: batch.groupName,
              brokerId: broker?.id,
              brokerName: broker?.canonicalName || brokerName,
              brokerPhone,
              originalSenderName: brokerName,
              originalSenderPhone: brokerPhone,
              seenAt,
              confidence,
              sourceType: 'BROKER_GROUP',
            }),
          );
          counters.createdListings += 1;
          if (broker) {
            await bumpBrokerInventoryStats(db, broker.id, {
              created: true,
              freshnessDays: 0,
            });
          }
        } catch (createErr) {
          const code =
            typeof createErr === 'object' && createErr && 'code' in createErr
              ? (createErr as { code?: number }).code
              : undefined;
          if (code !== 11000) throw createErr;
          const raced = await findInventoryByDedupeKey(db, dedupeKey);
          if (!raced) throw createErr;
          await refreshInventoryRecord(db, raced, {
            sourceMessageId: raw.id,
            lastImportBatchId: batch.id,
            lastSeenAt: seenAt,
            lastMessageAt: seenAt,
            ...proposedPartial,
          });
          counters.updatedListings += 1;
        }
      }
    } catch (err) {
      counters.failedMessages += 1;
      if (errors.length < BROKER_IMPORT_CONFIG.maxStoredErrors) {
        errors.push(
          `Candidate seq ${raw.sequence ?? i}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }

    i += 1;

    if (i % BROKER_IMPORT_CONFIG.candidateCheckpointSize === 0) {
      await updateImportBatch(db, batch.id, {
        resumeToken: (raw.sequence ?? i) + 1,
        lastProcessedMessage: raw.id,
        createdListings: counters.createdListings,
        updatedListings: counters.updatedListings,
        duplicateListings: counters.duplicateListings,
        failedMessages: counters.failedMessages,
        reviewQueued: counters.reviewQueued,
        unknownProjects: counters.unknownProjects,
        listingsExtracted: counters.listingsExtracted,
        averageConfidence:
          counters.confidenceCount > 0
            ? Math.round(counters.confidenceSum / counters.confidenceCount)
            : undefined,
        processingErrors: errors.slice(0, BROKER_IMPORT_CONFIG.maxStoredErrors),
      });
    }
  }

  return i;
}

/**
 * V2 checkpointed import. Mongo multi-doc transactions are not used in this
 * architecture; resilience comes from raw-message persistence + resumeToken.
 */
export async function importWhatsAppBrokerExport(input: {
  fileName: string;
  mimeType?: string | null;
  content: string;
  groupName: string;
  uploadedBy: string;
  uploadedByEmail?: string;
  /** Force resume of a specific batch (must match file hash). */
  resumeBatchId?: string;
}): Promise<BrokerImportSummary> {
  const validation = validateWhatsAppExportFile({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: Buffer.byteLength(input.content, 'utf8'),
  });
  if (validation.ok === false) {
    throw new Error(validation.error);
  }

  const groupName = input.groupName.trim();
  if (!groupName) {
    throw new Error('WhatsApp group name is required.');
  }

  const db = await getDatabase();
  const fileHash = hashFileContent(input.content);
  const errors: string[] = [];
  const forceResume = Boolean(input.resumeBatchId);

  let batch = input.resumeBatchId
    ? await getImportBatch(db, input.resumeBatchId)
    : await findBatchByFileHash(db, fileHash);

  if (batch && batch.fileHash !== fileHash && input.resumeBatchId) {
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

  const plan = planImport(batch, forceResume);
  if (!plan) throw new Error('Unable to create import batch.');
  if (plan.action === 'skip') {
    return summaryFromBatch(plan.batch, { alreadyProcessed: true });
  }

  const claimed = await claimImportBatch(db, plan.batch.id, BROKER_IMPORT_CONFIG.processingLeaseMs);
  if (!claimed) {
    throw new Error('This import is already in progress. Retry after the current run finishes.');
  }
  batch = claimed;
  const resumed = plan.resumed;
  const startedAt = batch.startedAt || new Date().toISOString();

  const counters = {
    createdListings: batch.createdListings || 0,
    updatedListings: batch.updatedListings || 0,
    duplicateListings: batch.duplicateListings || 0,
    failedMessages: batch.failedMessages || 0,
    reviewQueued: batch.reviewQueued || 0,
    unknownProjects: batch.unknownProjects || 0,
    confidenceSum: 0,
    confidenceCount: 0,
    listingsExtracted: batch.listingsExtracted || 0,
  };

  let currentStage = batch.stage || 'PENDING';

  try {
    // Stage 1: parse + persist raw messages (skip if already persisted)
    if (plan.needRawPersist || currentStage === 'PENDING') {
      const { messages, malformedLines } = parseWhatsAppExport(input.content);
      if (malformedLines > 0) {
        errors.push(`${malformedLines} orphan/malformed line(s) captured without failing the batch.`);
      }

      const now = new Date().toISOString();
      const rawDocs: OpsBrokerRawMessage[] = [];
      let candidateListings = 0;
      let malformedMessages = 0;
      let skippedMessages = 0;

      messages.forEach((msg, sequence) => {
        try {
          const detection =
            msg.parseStatus === 'PARSED' && !msg.isSystem
              ? detectListingCandidate(msg.rawMessage)
              : { isCandidate: false, score: 0, matchedSignals: [] as string[] };

          if (detection.isCandidate) candidateListings += 1;
          if (msg.parseStatus === 'MALFORMED') malformedMessages += 1;
          if (msg.parseStatus === 'SKIPPED' || msg.parseStatus === 'SYSTEM') skippedMessages += 1;

          const messageHash = hashMessage({
            groupName,
            senderName: msg.senderName,
            senderPhone: msg.senderPhone,
            messageTimestamp: msg.messageTimestamp,
            rawMessage: msg.rawMessage,
          });

          rawDocs.push({
            id: uuidv4(),
            batchId: batch!.id,
            groupName,
            senderName: msg.senderName,
            senderPhone: normalizePhone(msg.senderPhone) || msg.senderPhone,
            messageDate: msg.messageDate,
            messageTime: msg.messageTime,
            messageTimestamp: msg.messageTimestamp,
            rawMessage: msg.rawMessage,
            sourceFileName: validation.fileName,
            messageHash,
            parseStatus: msg.parseStatus,
            listingCandidate: detection.isCandidate,
            createdAt: now,
            sequence,
          });
        } catch {
          counters.failedMessages += 1;
        }
      });

      const chunk = BROKER_IMPORT_CONFIG.rawInsertChunkSize;
      for (let i = 0; i < rawDocs.length; i += chunk) {
        await insertRawMessages(db, rawDocs.slice(i, i + chunk));
        await updateImportBatch(db, batch.id, {
          lastProcessedMessage: rawDocs[Math.min(i + chunk, rawDocs.length) - 1]?.id,
        });
      }

      await updateImportBatch(db, batch.id, {
        stage: 'RAW_PERSISTED',
        totalMessages: messages.length,
        candidateListings,
        malformedMessages,
        skippedMessages,
        resumeToken: 0,
      });
      currentStage = 'RAW_PERSISTED';
      batch = (await getImportBatch(db, batch.id))!;
    }

    // Stage 2: inventory intelligence with paged candidates + checkpoints
    await updateImportBatch(db, batch.id, { stage: 'INVENTORY', importStatus: 'PROCESSING' });
    currentStage = 'INVENTORY';
    const aliasMap = await loadAliasMap(db);
    let fromSequence = typeof batch.resumeToken === 'number' ? batch.resumeToken : 0;
    let lastSeq = fromSequence;

    for (;;) {
      const candidates = await listCandidateMessagesForBatch(
        db,
        batch.id,
        fromSequence,
        BROKER_IMPORT_CONFIG.candidatePageSize,
      );
      if (!candidates.length) break;

      await processCandidateWindow({
        batch,
        candidates,
        startIndex: 0,
        aliasMap,
        counters,
        errors,
      });

      const last = candidates[candidates.length - 1];
      lastSeq = (last.sequence ?? fromSequence) + 1;
      fromSequence = lastSeq;
      await updateImportBatch(db, batch.id, {
        resumeToken: lastSeq,
        lastProcessedMessage: last.id,
        createdListings: counters.createdListings,
        updatedListings: counters.updatedListings,
        duplicateListings: counters.duplicateListings,
        failedMessages: counters.failedMessages,
        reviewQueued: counters.reviewQueued,
        unknownProjects: counters.unknownProjects,
        listingsExtracted: counters.listingsExtracted,
      });

      if (candidates.length < BROKER_IMPORT_CONFIG.candidatePageSize) break;
    }

    const averageConfidence =
      counters.confidenceCount > 0
        ? Math.round(counters.confidenceSum / counters.confidenceCount)
        : batch.averageConfidence;

    // Review queue is expected workflow — does not mark import PARTIAL
    const importStatus =
      counters.failedMessages > 0 && counters.createdListings + counters.updatedListings === 0
        ? 'FAILED'
        : counters.failedMessages > 0
          ? 'PARTIAL'
          : 'COMPLETED';

    const finished = await finalizeBatch(
      batch.id,
      {
        importStatus,
        createdListings: counters.createdListings,
        updatedListings: counters.updatedListings,
        duplicateListings: counters.duplicateListings,
        failedMessages: counters.failedMessages,
        reviewQueued: counters.reviewQueued,
        unknownProjects: counters.unknownProjects,
        listingsExtracted: counters.listingsExtracted,
        averageConfidence,
        processingErrors: errors.slice(0, BROKER_IMPORT_CONFIG.maxStoredErrors),
        failureReason: importStatus === 'FAILED' ? errors[0] || 'Import failed' : undefined,
        resumeToken: importStatus === 'PARTIAL' ? lastSeq : undefined,
      },
      startedAt,
      { markDone: true },
    );

    return summaryFromBatch(finished, { resumed });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    const madeProgress =
      counters.createdListings + counters.updatedListings + counters.reviewQueued > 0
      || currentStage === 'RAW_PERSISTED'
      || currentStage === 'INVENTORY';

    await finalizeBatch(
      batch.id,
      {
        importStatus: madeProgress ? 'PARTIAL' : 'FAILED',
        failureReason: message,
        processingErrors: [...errors, message].slice(0, BROKER_IMPORT_CONFIG.maxStoredErrors),
        createdListings: counters.createdListings,
        updatedListings: counters.updatedListings,
        duplicateListings: counters.duplicateListings,
        failedMessages: counters.failedMessages + 1,
        reviewQueued: counters.reviewQueued,
        unknownProjects: counters.unknownProjects,
        listingsExtracted: counters.listingsExtracted,
        stage: currentStage === 'PENDING' ? 'PENDING' : currentStage,
      },
      startedAt,
      // Keep stage for resume — do not force DONE on mid-flight failure
      { markDone: false },
    );

    if (madeProgress) {
      const latest = await getImportBatch(db, batch.id);
      return summaryFromBatch(latest || batch, { resumed });
    }
    throw err;
  }
}

export async function resumeBrokerImportBatch(input: {
  batchId: string;
  content: string;
  fileName: string;
  mimeType?: string | null;
  uploadedBy: string;
  uploadedByEmail?: string;
}): Promise<BrokerImportSummary> {
  const db = await getDatabase();
  const batch = await getImportBatch(db, input.batchId);
  if (!batch) throw new Error('Import batch not found.');
  if (batch.importStatus === 'COMPLETED') {
    return summaryFromBatch(batch, { alreadyProcessed: true });
  }
  return importWhatsAppBrokerExport({
    fileName: input.fileName,
    mimeType: input.mimeType,
    content: input.content,
    groupName: batch.groupName,
    uploadedBy: input.uploadedBy,
    uploadedByEmail: input.uploadedByEmail,
    resumeBatchId: batch.id,
  });
}
