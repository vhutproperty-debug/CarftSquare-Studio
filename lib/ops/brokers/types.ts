import type {
  BrokerFreshnessStatus,
  BrokerFurnishing,
  BrokerHistoryField,
  BrokerImportStatus,
  BrokerInventoryStatus,
  BrokerMessageParseStatus,
  BrokerReviewReason,
  BrokerReviewStatus,
  BrokerSourceType,
  BrokerTransactionType,
} from '@/lib/ops/brokers/statuses';

export type BrokerConfidenceBreakdown = {
  parserConfidence: number;
  projectConfidence: number;
  configurationConfidence: number;
  priceConfidence: number;
  phoneConfidence: number;
  overallConfidence: number;
};

export type OpsBrokerImportBatch = {
  id: string;
  groupName: string;
  fileName: string;
  fileHash: string;
  uploadedBy: string;
  uploadedByEmail?: string;
  uploadedAt: string;
  importStatus: BrokerImportStatus;
  totalMessages: number;
  candidateListings: number;
  createdListings: number;
  updatedListings: number;
  duplicateListings: number;
  failedMessages: number;
  processingErrors: string[];
  createdAt: string;
  updatedAt: string;
  /** V2 lifecycle + resume */
  startedAt?: string;
  finishedAt?: string;
  processingDurationMs?: number;
  failureReason?: string;
  lastProcessedMessage?: string;
  /** Index into listing-candidate raw messages for resume. */
  resumeToken?: number;
  stage?: 'PENDING' | 'RAW_PERSISTED' | 'INVENTORY' | 'DONE';
  skippedMessages?: number;
  malformedMessages?: number;
  reviewQueued?: number;
  unknownProjects?: number;
  listingsExtracted?: number;
  averageConfidence?: number;
  /** Optional content cache for resume without re-upload (truncated for huge files). */
  contentCached?: boolean;
  /** Async job progress (polled by import UI). */
  progress?: BrokerImportProgress;
  /** Cumulative stage timings (ms) for production profiling. */
  stageTimings?: BrokerImportStageTimings;
};

export type BrokerImportProgress = {
  phase:
    | 'queued'
    | 'upload'
    | 'fileRead'
    | 'validation'
    | 'whatsappParse'
    | 'messageExtraction'
    | 'normalization'
    | 'deduplication'
    | 'mongoQueries'
    | 'bulkWrites'
    | 'responseGeneration'
    | 'done'
    | 'failed';
  percent: number;
  processedCandidates: number;
  totalCandidates: number;
  message?: string;
  updatedAt: string;
};

export type BrokerImportStageTimings = {
  upload?: number;
  fileRead?: number;
  validation?: number;
  whatsappParse?: number;
  messageExtraction?: number;
  normalization?: number;
  deduplication?: number;
  mongoQueries?: number;
  bulkWrites?: number;
  responseGeneration?: number;
  total?: number;
};

export type OpsBrokerRawMessage = {
  id: string;
  batchId: string;
  groupName: string;
  senderName?: string;
  senderPhone?: string;
  messageDate?: string;
  messageTime?: string;
  messageTimestamp?: string;
  rawMessage: string;
  sourceFileName: string;
  messageHash: string;
  parseStatus: BrokerMessageParseStatus;
  listingCandidate: boolean;
  createdAt: string;
  /** Ordinal within batch for resume ordering. */
  sequence?: number;
};

export type OpsBrokerInventory = {
  id: string;
  brokerId?: string;
  brokerName?: string;
  brokerPhone?: string;
  /** Original WhatsApp sender provenance (never discarded). */
  originalSenderName?: string;
  originalSenderPhone?: string;
  groupName: string;
  projectName?: string;
  projectNormalized?: string;
  projectMapped?: boolean;
  tower?: string;
  wing?: string;
  unitNumber?: string;
  configuration?: string;
  bhk?: number;
  transactionType: BrokerTransactionType;
  propertyType?: string;
  carpetArea?: number;
  builtUpArea?: number;
  rent?: number;
  salePrice?: number;
  deposit?: number;
  maintenance?: number;
  furnishing: BrokerFurnishing;
  parking?: string;
  availability?: string;
  availableFrom?: string;
  floor?: string;
  notes?: string;
  extractedText?: {
    rentText?: string;
    salePriceText?: string;
    depositText?: string;
    areaText?: string;
    configurationText?: string;
  };
  firstSeenAt: string;
  lastSeenAt: string;
  lastMessageAt?: string;
  lastImportBatchId: string;
  sourceMessageIds: string[];
  occurrenceCount: number;
  freshnessStatus: BrokerFreshnessStatus;
  status: BrokerInventoryStatus;
  dedupeKey: string;
  sourceType: BrokerSourceType;
  overallConfidence?: number;
  parserConfidence?: number;
  projectConfidence?: number;
  configurationConfidence?: number;
  priceConfidence?: number;
  phoneConfidence?: number;
  createdAt: string;
  updatedAt: string;
};

export type OpsBrokerInventoryHistory = {
  id: string;
  inventoryId: string;
  fieldChanged: BrokerHistoryField | string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  sourceMessageId?: string;
  importBatchId?: string;
  changedAt: string;
};

export type OpsBrokerReviewItem = {
  id: string;
  status: BrokerReviewStatus;
  reasons: BrokerReviewReason[];
  batchId: string;
  groupName: string;
  rawMessageId: string;
  dedupeKey: string;
  existingInventoryId?: string;
  proposed: Partial<OpsBrokerInventory>;
  confidence: BrokerConfidenceBreakdown;
  dedupeConfidence: number;
  notes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionInventoryId?: string;
  createdAt: string;
  updatedAt: string;
};

export type OpsBrokerDirectory = {
  id: string;
  canonicalName: string;
  phones: string[];
  aliases: string[];
  agency?: string;
  notes?: string;
  whatsappGroups: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  inventoryCount: number;
  activeInventory: number;
  averageFreshnessDays?: number;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
};

export type OpsProjectAlias = {
  id: string;
  canonicalProject: string;
  aliases: string[];
  city?: string;
  locality?: string;
  builder?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OpsUnknownProjectSighting = {
  id: string;
  projectName: string;
  normalizedKey: string;
  groupName?: string;
  batchId?: string;
  messageId?: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type BrokerInventoryQueueItem = OpsBrokerInventory & {
  latestMessagePreview?: string;
};

export type BrokerWorkspaceMetrics = {
  totalActive: number;
  fresh: number;
  aging: number;
  stale: number;
  rental: number;
  sale: number;
  uniqueProjects: number;
  uniqueBrokers: number;
  lastImportAt: string | null;
  pendingReviews?: number;
  averageConfidence?: number;
};

export type BrokerWorkspaceResult = {
  items: BrokerInventoryQueueItem[];
  metrics: BrokerWorkspaceMetrics;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    projects: string[];
    brokers: string[];
    groups: string[];
  };
};

export type BrokerImportSummary = {
  batch: OpsBrokerImportBatch;
  alreadyProcessed: boolean;
  resumed?: boolean;
  messagesParsed: number;
  listingCandidates: number;
  createdListings: number;
  updatedListings: number;
  duplicateListings: number;
  failedMessages: number;
  reviewQueued?: number;
  unknownProjects?: number;
  averageConfidence?: number;
  errors: string[];
  stageTimings?: BrokerImportStageTimings;
  /** True when POST accepted work and processing continues in background. */
  async?: boolean;
};

export type BrokerDemandMatchHit = {
  inventoryId: string;
  score: number;
  reasons: string[];
  inventory: OpsBrokerInventory;
  latestRawMessage?: string;
};

export type ParsedWhatsAppMessage = {
  senderName?: string;
  senderPhone?: string;
  messageDate?: string;
  messageTime?: string;
  messageTimestamp?: string;
  rawMessage: string;
  parseStatus: BrokerMessageParseStatus;
  isSystem: boolean;
};

export type ExtractedListingFields = {
  projectName?: string;
  projectNormalized?: string;
  projectMapped?: boolean;
  tower?: string;
  wing?: string;
  unitNumber?: string;
  configuration?: string;
  bhk?: number;
  transactionType: BrokerTransactionType;
  propertyType?: string;
  carpetArea?: number;
  builtUpArea?: number;
  rent?: number;
  salePrice?: number;
  deposit?: number;
  maintenance?: number;
  furnishing: BrokerFurnishing;
  parking?: string;
  availability?: string;
  availableFrom?: string;
  floor?: string;
  notes?: string;
  rentText?: string;
  salePriceText?: string;
  depositText?: string;
  areaText?: string;
  configurationText?: string;
};

export type BrokerAnalyticsResult = {
  topBrokers: Array<{ brokerId?: string; brokerName: string; count: number }>;
  topGroups: Array<{ groupName: string; count: number }>;
  freshness: { fresh: number; aging: number; stale: number };
  topProjects: Array<{ project: string; count: number }>;
  rentVsSale: { rent: number; sale: number; unknown: number };
  averageRepostFrequency: number;
  brokerActivityTrend: Array<{ day: string; count: number }>;
  inventoryAgeDistribution: Array<{ bucket: string; count: number }>;
  unknownProjectTrends: Array<{ projectName: string; count: number }>;
};

export type BrokerBatchQualityDetail = {
  batch: OpsBrokerImportBatch;
  messagesParsed: number;
  listingCandidates: number;
  listingsExtracted: number;
  newInventory: number;
  updatedInventory: number;
  reviewQueue: number;
  skipped: number;
  malformed: number;
  failed: number;
  unknownProjects: number;
  averageConfidence: number;
  topBrokers: Array<{ name: string; count: number }>;
  topProjects: Array<{ name: string; count: number }>;
  malformedMessages: OpsBrokerRawMessage[];
  reviewItems: OpsBrokerReviewItem[];
  unknownProjectList: OpsUnknownProjectSighting[];
};
