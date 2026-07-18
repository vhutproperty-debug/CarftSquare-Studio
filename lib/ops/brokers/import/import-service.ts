import { v4 as uuidv4 } from 'uuid';
import { BROKER_IMPORT_CONFIG, REVIEW_CONFIG } from '@/lib/ops/brokers/config';
import {
  computeConfidenceBreakdown,
  scoreDedupeConfidence,
} from '@/lib/ops/brokers/confidence';
import { detectListingCandidate } from '@/lib/ops/brokers/detect/listing-detector';
import { dedupeKeyFromExtraction } from '@/lib/ops/brokers/dedupe/dedupe-key';
import {
  bulkBumpBrokerInventoryStats,
  resolveOrCreateBroker,
} from '@/lib/ops/brokers/directory';
import { extractListingFields } from '@/lib/ops/brokers/extract/listing-extractor';
import { validateWhatsAppExportFile } from '@/lib/ops/brokers/import/file-validation';
import { StageTimer, type ImportTimings } from '@/lib/ops/brokers/import/timings';
import { daysSince } from '@/lib/ops/brokers/freshness';
import {
  bulkTrackUnknownProjects,
  loadAliasMap,
} from '@/lib/ops/brokers/normalize/project-aliases';
import { normalizeExtractedListing, normalizePhone } from '@/lib/ops/brokers/normalize/normalize';
import { hashFileContent, hashMessage, parseWhatsAppExport } from '@/lib/ops/brokers/parse/whatsapp-parser';
import { bulkEnqueueReviewItems, decideReviewRouting } from '@/lib/ops/brokers/review';
import {
  buildInventoryRecord,
  bulkApplyInventoryRefreshes,
  bulkInsertInventoryRecords,
  claimImportBatch,
  createImportBatch,
  ensureBrokerIndexes,
  findBatchByFileHash,
  findInventoryByDedupeKey,
  findInventoryByDedupeKeys,
  getDatabase,
  getImportBatch,
  insertRawMessages,
  listCandidateMessagesForBatch,
  prepareInventoryRefresh,
  updateImportBatch,
} from '@/lib/ops/brokers/store';
import type {
  BrokerConfidenceBreakdown,
  BrokerImportProgress,
  BrokerImportSummary,
  OpsBrokerDirectory,
  OpsBrokerImportBatch,
  OpsBrokerInventory,
  OpsBrokerRawMessage,
  OpsBrokerReviewItem,
} from '@/lib/ops/brokers/types';

function summaryFromBatch(
  batch: OpsBrokerImportBatch,
  opts?: { alreadyProcessed?: boolean; resumed?: boolean; stageTimings?: ImportTimings },
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
    stageTimings: opts?.stageTimings || batch.stageTimings,
  };
}

async function setImportProgress(
  batchId: string,
  progress: Omit<BrokerImportProgress, 'updatedAt'>,
  stageTimings?: ImportTimings,
): Promise<void> {
  const db = await getDatabase();
  await updateImportBatch(db, batchId, {
    progress: { ...progress, updatedAt: new Date().toISOString() },
    ...(stageTimings ? { stageTimings } : {}),
  });
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
      needRawPersist,
    };
  }

  return { action: 'skip', batch };
}

function brokerCacheKey(phone?: string, name?: string): string {
  const p = normalizePhone(phone) || '';
  const n = (name || '').trim().toLowerCase();
  return `${p}|${n}`;
}

async function processCandidateWindow(input: {
  batch: OpsBrokerImportBatch;
  candidates: OpsBrokerRawMessage[];
  aliasMap: Map<string, string>;
  brokerCache: Map<string, OpsBrokerDirectory | null>;
  timer: StageTimer;
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
  globalCandidateOffset: number;
  totalCandidates: number;
}): Promise<void> {
  const db = await getDatabase();
  const { batch, candidates, aliasMap, brokerCache, timer, counters, errors } = input;

  type Prepared = {
    raw: OpsBrokerRawMessage;
    extracted: ReturnType<typeof normalizeExtractedListing>;
    confidence: BrokerConfidenceBreakdown;
    brokerPhone?: string;
    brokerName?: string;
  };

  const prepared: Prepared[] = [];

  for (const raw of candidates) {
    try {
      const extractedFields = timer.timeSync('messageExtraction', () =>
        extractListingFields(raw.rawMessage),
      );
      const extracted = timer.timeSync('normalization', () =>
        normalizeExtractedListing(extractedFields, raw.rawMessage, aliasMap),
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
      prepared.push({ raw, extracted, confidence, brokerPhone, brokerName });
    } catch (err) {
      counters.failedMessages += 1;
      if (errors.length < BROKER_IMPORT_CONFIG.maxStoredErrors) {
        errors.push(
          `Candidate seq ${raw.sequence}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }
  }

  // Resolve unique brokers in parallel (independent lookups)
  const uniqueBrokerInputs = new Map<
    string,
    { senderName?: string; senderPhone?: string; seenAt: string }
  >();
  for (const row of prepared) {
    const key = brokerCacheKey(row.brokerPhone, row.brokerName);
    if (!brokerCache.has(key) && !uniqueBrokerInputs.has(key)) {
      uniqueBrokerInputs.set(key, {
        senderName: row.brokerName,
        senderPhone: row.brokerPhone,
        seenAt: row.raw.messageTimestamp || new Date().toISOString(),
      });
    }
  }

  if (uniqueBrokerInputs.size) {
    await timer.time('mongoQueries', async () => {
      await Promise.all(
        [...uniqueBrokerInputs.entries()].map(async ([key, inp]) => {
          const broker = await resolveOrCreateBroker(db, {
            senderName: inp.senderName,
            senderPhone: inp.senderPhone,
            groupName: batch.groupName,
            seenAt: inp.seenAt,
          });
          brokerCache.set(key, broker);
        }),
      );
    });
  }

  // Prefetch inventory by dedupe keys (single $in query path)
  const provisionalKeys: string[] = [];
  for (const row of prepared) {
    const broker = brokerCache.get(brokerCacheKey(row.brokerPhone, row.brokerName)) || null;
    provisionalKeys.push(
      dedupeKeyFromExtraction(row.extracted, {
        brokerName: broker?.canonicalName || row.brokerName,
        brokerPhone: row.brokerPhone || broker?.phones[0],
      }),
    );
  }

  const inventoryMap = await timer.time('mongoQueries', () =>
    findInventoryByDedupeKeys(db, provisionalKeys),
  );

  type ReviewPayload = Omit<OpsBrokerReviewItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>;
  const reviewBuffer: ReviewPayload[] = [];
  const unknownBuffer: Array<{
    projectName: string;
    groupName?: string;
    batchId?: string;
    messageId?: string;
  }> = [];
  const createBuffer: OpsBrokerInventory[] = [];
  const refreshBuffer: Array<{
    id: string;
    next: Partial<OpsBrokerInventory>;
    history: ReturnType<typeof prepareInventoryRefresh>['history'];
  }> = [];
  const brokerBumps: Array<{ brokerId: string; created: boolean; freshnessDays?: number }> = [];

  for (let i = 0; i < prepared.length; i += 1) {
    const row = prepared[i];
    const { raw, extracted, confidence, brokerPhone, brokerName } = row;
    try {
      timer.start('deduplication');

      if (!extracted.projectMapped && extracted.projectName) {
        unknownBuffer.push({
          projectName: extracted.projectName,
          groupName: batch.groupName,
          batchId: batch.id,
          messageId: raw.id,
        });
        counters.unknownProjects += 1;
      }

      const broker = brokerCache.get(brokerCacheKey(brokerPhone, brokerName)) || null;
      const dedupeKey = dedupeKeyFromExtraction(extracted, {
        brokerName: broker?.canonicalName || brokerName,
        brokerPhone: brokerPhone || broker?.phones[0],
      });

      let existing = inventoryMap.get(dedupeKey) || null;
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
        reviewBuffer.push({
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
        timer.end('deduplication');
        continue;
      }

      if (existing?.sourceMessageIds?.includes(raw.id)) {
        timer.end('deduplication');
        continue;
      }

      if (existing && routing.action === 'auto_merge') {
        const before = {
          rent: existing.rent,
          salePrice: existing.salePrice,
          configuration: existing.configuration,
          furnishing: existing.furnishing,
        };
        const preparedRefresh = prepareInventoryRefresh(existing, {
          sourceMessageId: raw.id,
          lastImportBatchId: batch.id,
          lastSeenAt: seenAt,
          lastMessageAt: seenAt,
          ...proposedPartial,
        });
        inventoryMap.set(dedupeKey, preparedRefresh.updated);
        refreshBuffer.push({
          id: existing.id,
          next: preparedRefresh.next,
          history: preparedRefresh.history,
        });
        const pureRepost =
          before.rent === extracted.rent
          && before.salePrice === extracted.salePrice
          && before.configuration === extracted.configuration
          && before.furnishing === extracted.furnishing;
        if (pureRepost) counters.duplicateListings += 1;
        else counters.updatedListings += 1;
        if (broker) {
          brokerBumps.push({
            brokerId: broker.id,
            created: false,
            freshnessDays: daysSince(seenAt),
          });
        }
      } else {
        const record = buildInventoryRecord({
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
        });
        createBuffer.push(record);
        inventoryMap.set(dedupeKey, record);
        counters.createdListings += 1;
        if (broker) {
          brokerBumps.push({
            brokerId: broker.id,
            created: true,
            freshnessDays: 0,
          });
        }
      }
      timer.end('deduplication');
    } catch (err) {
      timer.end('deduplication');
      counters.failedMessages += 1;
      if (errors.length < BROKER_IMPORT_CONFIG.maxStoredErrors) {
        errors.push(
          `Candidate seq ${raw.sequence ?? i}: ${
            err instanceof Error ? err.message : 'unknown error'
          }`,
        );
      }
    }
  }

  await timer.time('bulkWrites', async () => {
    if (unknownBuffer.length) {
      await bulkTrackUnknownProjects(db, unknownBuffer);
    }
    if (reviewBuffer.length) {
      const created = await bulkEnqueueReviewItems(db, reviewBuffer);
      counters.reviewQueued += created;
    }
    if (createBuffer.length) {
      const { duplicateKeys } = await bulkInsertInventoryRecords(db, createBuffer);
      for (const key of duplicateKeys) {
        // Race with unique index — refresh instead (same as prior 11000 path)
        const raced = await findInventoryByDedupeKey(db, key);
        const pending = createBuffer.find((c) => c.dedupeKey === key);
        if (!raced || !pending) continue;
        counters.createdListings = Math.max(0, counters.createdListings - 1);
        const preparedRefresh = prepareInventoryRefresh(raced, {
          sourceMessageId: pending.sourceMessageIds[0],
          lastImportBatchId: batch.id,
          lastSeenAt: pending.lastSeenAt,
          lastMessageAt: pending.lastMessageAt,
          ...pending,
        });
        inventoryMap.set(key, preparedRefresh.updated);
        refreshBuffer.push({
          id: raced.id,
          next: preparedRefresh.next,
          history: preparedRefresh.history,
        });
        counters.updatedListings += 1;
      }
    }
    if (refreshBuffer.length) {
      await bulkApplyInventoryRefreshes(db, refreshBuffer);
    }
    if (brokerBumps.length) {
      await bulkBumpBrokerInventoryStats(db, brokerBumps);
    }
  });

  const processed = input.globalCandidateOffset + candidates.length;
  const percent =
    input.totalCandidates > 0
      ? Math.min(99, Math.round((processed / input.totalCandidates) * 100))
      : 50;
  await setImportProgress(
    batch.id,
    {
      phase: 'deduplication',
      percent,
      processedCandidates: processed,
      totalCandidates: input.totalCandidates,
      message: `Processed ${processed}/${input.totalCandidates} candidates`,
    },
    timer.snapshot(),
  );
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
  /** Optional pre-measured upload / file-read timings from the HTTP layer. */
  preloadTimings?: Pick<ImportTimings, 'upload' | 'fileRead'>;
}): Promise<BrokerImportSummary> {
  const timer = new StageTimer();
  if (input.preloadTimings?.upload) timer.add('upload', input.preloadTimings.upload);
  if (input.preloadTimings?.fileRead) timer.add('fileRead', input.preloadTimings.fileRead);

  const validation = timer.timeSync('validation', () =>
    validateWhatsAppExportFile({
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: Buffer.byteLength(input.content, 'utf8'),
    }),
  );
  if (validation.ok === false) {
    throw new Error(validation.error);
  }

  const groupName = input.groupName.trim();
  if (!groupName) {
    throw new Error('WhatsApp group name is required.');
  }

  const db = await getDatabase();
  await timer.time('mongoQueries', () => ensureBrokerIndexes(db));

  const fileHash = hashFileContent(input.content);
  const errors: string[] = [];
  const forceResume = Boolean(input.resumeBatchId);

  let batch = input.resumeBatchId
    ? await timer.time('mongoQueries', () => getImportBatch(db, input.resumeBatchId!))
    : await timer.time('mongoQueries', () => findBatchByFileHash(db, fileHash));

  if (batch && batch.fileHash !== fileHash && input.resumeBatchId) {
    throw new Error('Resume file hash does not match the original batch.');
  }

  if (!batch) {
    batch = await timer.time('mongoQueries', () =>
      createImportBatch(db, {
        groupName,
        fileName: validation.fileName,
        fileHash,
        uploadedBy: input.uploadedBy,
        uploadedByEmail: input.uploadedByEmail,
      }),
    );
  }

  const plan = planImport(batch, forceResume);
  if (!plan) throw new Error('Unable to create import batch.');
  if (plan.action === 'skip') {
    timer.timeSync('responseGeneration', () => undefined);
    return summaryFromBatch(plan.batch, {
      alreadyProcessed: true,
      stageTimings: timer.snapshot(),
    });
  }

  const claimed = await timer.time('mongoQueries', () =>
    claimImportBatch(db, plan.batch.id, BROKER_IMPORT_CONFIG.processingLeaseMs),
  );
  if (!claimed) {
    throw new Error('This import is already in progress. Retry after the current run finishes.');
  }
  batch = claimed;
  const resumed = plan.resumed;
  const startedAt = batch.startedAt || new Date().toISOString();

  await setImportProgress(batch.id, {
    phase: 'whatsappParse',
    percent: 5,
    processedCandidates: 0,
    totalCandidates: batch.candidateListings || 0,
    message: 'Starting import',
  }, timer.snapshot());

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
  const brokerCache = new Map<string, OpsBrokerDirectory | null>();

  try {
    if (plan.needRawPersist || currentStage === 'PENDING') {
      const { messages, malformedLines } = timer.timeSync('whatsappParse', () =>
        parseWhatsAppExport(input.content),
      );
      if (malformedLines > 0) {
        errors.push(`${malformedLines} orphan/malformed line(s) captured without failing the batch.`);
      }

      await setImportProgress(batch.id, {
        phase: 'whatsappParse',
        percent: 15,
        processedCandidates: 0,
        totalCandidates: 0,
        message: `Parsed ${messages.length} messages`,
      }, timer.snapshot());

      const now = new Date().toISOString();
      const rawDocs: OpsBrokerRawMessage[] = [];
      let candidateListings = 0;
      let malformedMessages = 0;
      let skippedMessages = 0;

      timer.timeSync('messageExtraction', () => {
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
      });

      const chunk = BROKER_IMPORT_CONFIG.rawInsertChunkSize;
      await timer.time('bulkWrites', async () => {
        const writes: Promise<unknown>[] = [];
        for (let i = 0; i < rawDocs.length; i += chunk) {
          writes.push(insertRawMessages(db, rawDocs.slice(i, i + chunk)));
        }
        // Parallel chunk inserts (unordered across chunks; unique index handles dups)
        const concurrency = 3;
        for (let i = 0; i < writes.length; i += concurrency) {
          await Promise.all(writes.slice(i, i + concurrency));
        }
      });

      await updateImportBatch(db, batch.id, {
        stage: 'RAW_PERSISTED',
        totalMessages: messages.length,
        candidateListings,
        malformedMessages,
        skippedMessages,
        resumeToken: 0,
        stageTimings: timer.snapshot(),
      });
      currentStage = 'RAW_PERSISTED';
      batch = (await getImportBatch(db, batch.id))!;
    }

    await updateImportBatch(db, batch.id, { stage: 'INVENTORY', importStatus: 'PROCESSING' });
    currentStage = 'INVENTORY';

    const aliasMap = await timer.time('mongoQueries', () => loadAliasMap(db));
    let fromSequence = typeof batch.resumeToken === 'number' ? batch.resumeToken : 0;
    let lastSeq = fromSequence;
    const totalCandidates = batch.candidateListings || 0;
    let processedCandidates = fromSequence;

    await setImportProgress(batch.id, {
      phase: 'normalization',
      percent: 25,
      processedCandidates,
      totalCandidates,
      message: 'Extracting and normalizing listings',
    }, timer.snapshot());

    for (;;) {
      const candidates = await timer.time('mongoQueries', () =>
        listCandidateMessagesForBatch(
          db,
          batch!.id,
          fromSequence,
          BROKER_IMPORT_CONFIG.candidatePageSize,
        ),
      );
      if (!candidates.length) break;

      await processCandidateWindow({
        batch,
        candidates,
        aliasMap,
        brokerCache,
        timer,
        counters,
        errors,
        globalCandidateOffset: processedCandidates,
        totalCandidates,
      });

      processedCandidates += candidates.length;
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
        stageTimings: timer.snapshot(),
      });

      if (candidates.length < BROKER_IMPORT_CONFIG.candidatePageSize) break;
    }

    const averageConfidence =
      counters.confidenceCount > 0
        ? Math.round(counters.confidenceSum / counters.confidenceCount)
        : batch.averageConfidence;

    const importStatus =
      counters.failedMessages > 0 && counters.createdListings + counters.updatedListings === 0
        ? 'FAILED'
        : counters.failedMessages > 0
          ? 'PARTIAL'
          : 'COMPLETED';

    timer.start('responseGeneration');
    const timings = timer.snapshot();
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
        stageTimings: timings,
        progress: {
          phase: importStatus === 'FAILED' ? 'failed' : 'done',
          percent: 100,
          processedCandidates: totalCandidates,
          totalCandidates,
          message: importStatus === 'FAILED' ? 'Import failed' : 'Import complete',
          updatedAt: new Date().toISOString(),
        },
      },
      startedAt,
      { markDone: true },
    );
    timer.end('responseGeneration');

    return summaryFromBatch(finished, {
      resumed,
      stageTimings: timer.snapshot(),
    });
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
        stageTimings: timer.snapshot(),
        progress: {
          phase: 'failed',
          percent: 100,
          processedCandidates: 0,
          totalCandidates: batch.candidateListings || 0,
          message,
          updatedAt: new Date().toISOString(),
        },
      },
      startedAt,
      { markDone: false },
    );

    if (madeProgress) {
      const latest = await getImportBatch(db, batch.id);
      return summaryFromBatch(latest || batch, {
        resumed,
        stageTimings: timer.snapshot(),
      });
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
