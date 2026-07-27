export type ResearchWorkspace = {
  id: string;
  name: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchPortalConnectionStatus = 'disconnected' | 'connected' | 'error' | 'pending';

export type ResearchPortalConnection = {
  id: string;
  workspaceId: string;
  portalKey: string;
  portalName: string;
  status: ResearchPortalConnectionStatus;
  lastSyncedAt?: string;
  /** Exact last connector/validation failure message for UI. */
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchQueryStatus = 'draft' | 'queued' | 'running' | 'completed' | 'failed';

export type ResearchQuery = {
  id: string;
  workspaceId: string;
  title: string;
  naturalLanguage: string;
  status: ResearchQueryStatus;
  createdBy: string;
  /** Structured plan snapshot after planner runs. */
  plan?: ResearchPlanSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type ResearchRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ResearchRun = {
  id: string;
  workspaceId: string;
  queryId: string;
  status: ResearchRunStatus;
  portalKeys?: string[];
  errorMessage?: string;
  listingCount?: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchResult = {
  id: string;
  workspaceId: string;
  runId: string;
  queryId: string;
  summary?: string;
  payload?: Record<string, unknown>;
  listings?: ResearchListing[];
  createdAt: string;
};

export type ResearchSavedSearch = {
  id: string;
  workspaceId: string;
  name: string;
  naturalLanguage: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchBrowserSessionStatus =
  | 'idle'
  | 'active'
  | 'expired'
  | 'error'
  | 'needs_login'
  | 'valid';

/** Persistent authenticated browser session for a portal + workspace. */
export type ResearchBrowserSession = {
  id: string;
  workspaceId: string;
  /** Portal key (housing, magicbricks, …). */
  portal: string;
  portalKey?: string;
  browserProfile: string;
  encryptedCookies?: string;
  encryptedStorage?: string;
  sessionStatus: ResearchBrowserSessionStatus;
  /** @deprecated Prefer sessionStatus — kept for Phase 1 compatibility. */
  status?: ResearchBrowserSessionStatus;
  lastVerified?: string;
  expiresAt?: string;
  lastUsed?: string;
  /** Exact last validation failure (HTTP status / timeout / exception). */
  lastValidationError?: string;
  /**
   * Operational: extractors returned empty while session remained valid
   * (portal DOM/layout change). Does not imply needs_login.
   */
  extractorDegraded?: boolean;
  extractorDegradationReason?: string | null;
  extractorDegradedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchActivityLog = {
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export type ResearchDashboardSnapshot = {
  researchRuns: number;
  connectedPortals: number;
  recentSearches: number;
  savedSearches: number;
  todaysActivity: number;
};

export type ResearchTransactionType = 'RENT' | 'SALE' | 'UNKNOWN';

export type ResearchPlanCriteria = {
  project?: string;
  /** Multi-project compare (Phase 3). */
  projects?: string[];
  locality?: string;
  city?: string;
  bhk?: number;
  transactionType?: ResearchTransactionType;
  minBudget?: number;
  maxBudget?: number;
  furnishing?: string;
  facing?: string;
  listingSource?: 'owner' | 'broker' | 'any';
  postedSince?: 'today' | 'yesterday' | '7d' | 'any';
  exclusions?: string[];
  keywords?: string[];
  portals?: string[];
};

export type ResearchAiMessageRole = 'user' | 'assistant' | 'system';

export type ResearchAiMessage = {
  id: string;
  role: ResearchAiMessageRole;
  content: string;
  createdAt: string;
};

export type ResearchAiProgressPhase =
  | 'idle'
  | 'understanding'
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'reporting'
  | 'completed'
  | 'failed'
  | 'needs_clarification';

export type ResearchAiProgress = {
  phase: ResearchAiProgressPhase;
  percent: number;
  message: string;
  portalsTotal: number;
  portalsDone: number;
  listingsCollected: number;
  duplicatesRemoved: number;
  estimatedCompletionAt?: string;
  updatedAt: string;
  /** Live activity feed for the research OS timeline (additive). */
  activity?: ResearchAiActivityEvent[];
};

export type ResearchAiActivityEvent = {
  id: string;
  at: string;
  message: string;
  status: 'running' | 'ok' | 'fail' | 'info';
  portal?: string;
  count?: number;
};

export type ResearchScoredListing = ResearchListing & {
  relevanceScore: number;
  scoreBreakdown: Record<string, number>;
  explanation: string;
  duplicateGroupId?: string;
  portalRefs?: Array<{ portal: string; url?: string; listingId: string }>;
  rentPerSqft?: number;
  carpetArea?: number;
  tower?: string;
  unit?: string;
  broker?: string;
  parking?: string;
  amenities?: string[];
  facing?: string;
  listingSource?: 'owner' | 'broker' | 'unknown';
  listedBy?: 'owner' | 'broker' | 'builder' | 'unknown';
  freshnessHours?: number;
};

export type ResearchMarketInsights = {
  averageAskingRent?: number;
  medianAskingRent?: number;
  minAskingRent?: number;
  maxAskingRent?: number;
  listingCount: number;
  uniquePropertyCount: number;
  duplicatePercentage: number;
  portalDistribution: Record<string, number>;
  inventoryByProject: Record<string, number>;
  outlierListingIds: string[];
  notes: string[];
};

export type ResearchReport = {
  executiveSummary: string;
  searchStrategy: string;
  portalsSearched: string[];
  listingsFound: number;
  duplicatesRemoved: number;
  topMatches: ResearchScoredListing[];
  comparisonTable: Array<Record<string, string | number | undefined>>;
  observations: string[];
  marketInsights: ResearchMarketInsights;
  recommendedNextSteps: string[];
  warnings: string[];
  researchConfidence: number;
  generatedAt: string;
  metadata: {
    sessionId: string;
    workspaceId: string;
    naturalLanguageHistory: string[];
    criteria: ResearchPlanCriteria;
  };
};

export type ResearchAiDecisionAudit = {
  id: string;
  action: string;
  rationale: string;
  evidence?: Record<string, unknown>;
  createdAt: string;
};

export type ResearchAiSessionStatus =
  | 'active'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_clarification';

/** Conversational research memory (Phase 3). */
export type ResearchAiSession = {
  id: string;
  workspaceId: string;
  createdBy: string;
  title: string;
  status: ResearchAiSessionStatus;
  goals: string[];
  filters: ResearchPlanCriteria;
  exclusions: string[];
  assumptions: string[];
  messages: ResearchAiMessage[];
  progress: ResearchAiProgress;
  queryIds: string[];
  runIds: string[];
  listings: ResearchScoredListing[];
  report?: ResearchReport;
  auditLog: ResearchAiDecisionAudit[];
  clarificationQuestion?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResearchPlanStep = {
  id: string;
  label: string;
  connectorKey: string;
  action: 'validate_session' | 'execute_search' | 'collect_listings' | 'extract';
};

export type ResearchPlanSnapshot = {
  criteria: ResearchPlanCriteria;
  steps: ResearchPlanStep[];
  interpretedAs: string[];
};

export type ResearchListing = {
  id: string;
  portal: string;
  title?: string;
  projectName?: string;
  locality?: string;
  configuration?: string;
  bhk?: number;
  rent?: number;
  salePrice?: number;
  /** Built-up / carpet area in sq.ft when extracted from the portal card. */
  areaSqft?: number;
  furnishing?: string;
  url?: string;
  postedAt?: string;
  rawText?: string;
  extracted?: Record<string, unknown>;
  /**
   * Poster type detected from portal card/detail text.
   * Optional — omit when the portal signal is unclear.
   */
  listedBy?: 'owner' | 'broker' | 'builder' | 'unknown';
};

export type ConnectorSearchRequest = {
  workspaceId: string;
  criteria: ResearchPlanCriteria;
  sessionId?: string;
  /** When true, caller already validated — skip a second live browser check. */
  skipValidation?: boolean;
};

export type ConnectorSearchResponse = {
  ok: boolean;
  listings: ResearchListing[];
  sessionStatus: ResearchBrowserSessionStatus;
  message?: string;
  screenshotPath?: string;
  /** True when auth succeeded but extractors returned nothing (portal DOM change). */
  degraded?: boolean;
  degradationReason?: string;
};
