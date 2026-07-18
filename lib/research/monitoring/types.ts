import type { ResearchPlanCriteria } from '@/lib/research/types';

export type WatchScope =
  | 'project'
  | 'building'
  | 'tower'
  | 'property'
  | 'broker'
  | 'builder'
  | 'locality'
  | 'landmark'
  | 'polygon'
  | 'saved_search'
  | 'custom_query';

export type WatchFrequency =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'manual'
  | 'event';

export type WatchPriority = 'low' | 'normal' | 'high' | 'critical';
export type WatchStatus = 'active' | 'paused' | 'error' | 'disabled';
export type WatchHealth = 'healthy' | 'degraded' | 'failing' | 'idle' | 'unknown';

export type WatchSearchStrategy = {
  mode: 'delta' | 'full_refresh' | 'adaptive';
  portals?: string[];
  maxListingsPerPortal?: number;
  skipUnchangedPortals?: boolean;
  preferKnowledgeGraph?: boolean;
};

export type WatchPolygon = {
  label?: string;
  /** GeoJSON-like ring [[lng, lat], ...] */
  coordinates: Array<[number, number]>;
};

export type WatchStatistics = {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalNewListings: number;
  totalChangedListings: number;
  totalRemovedListings: number;
  totalAlerts: number;
  lastFetched: number;
  avgDurationMs: number | null;
};

export type ResearchWatch = {
  id: string;
  workspaceId: string;
  /** Owner admin id (same as createdBy for BC). */
  ownerId: string;
  createdBy: string;
  name: string;
  scope: WatchScope;
  targetId?: string;
  targetLabel?: string;
  savedSearchId?: string;
  landmark?: string;
  polygon?: WatchPolygon;
  /** Decrypted criteria used by crawlers (never returned with secrets). */
  filters: ResearchPlanCriteria;
  /** AES-GCM encrypted watch definition at rest. */
  encryptedDefinition?: string;
  naturalLanguage?: string;
  searchStrategy: WatchSearchStrategy;
  frequency: WatchFrequency;
  priority: WatchPriority;
  /** Explicit enable flag; false implies paused. */
  enabled: boolean;
  status: WatchStatus;
  health: WatchHealth;
  statistics: WatchStatistics;
  lastRunAt?: string;
  nextRunAt?: string;
  lastChangeDetectedAt?: string;
  lastJobId?: string;
  lastError?: string;
  runCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WatchJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

export type WatchJobPhase =
  | 'queued'
  | 'plan'
  | 'delta_compare'
  | 'browser_crawl'
  | 'knowledge_update'
  | 'change_detect'
  | 'alert_generate'
  | 'trend_update'
  | 'notify'
  | 'done';

export type WatchJobWorkerType =
  | 'scheduler'
  | 'browser_crawl'
  | 'knowledge_update'
  | 'alert_generate'
  | 'trend_update'
  | 'notification'
  | 'image_processing'
  | 'relationship_resolution'
  | 'retry'
  | 'health';

export type WatchJob = {
  id: string;
  workspaceId: string;
  watchId: string;
  status: WatchJobStatus;
  phase: WatchJobPhase;
  workerType?: WatchJobWorkerType;
  priority: WatchPriority;
  attempt: number;
  maxAttempts: number;
  scheduledFor: string;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
  planSummary?: Record<string, unknown>;
  stats?: {
    knownBefore: number;
    fetched: number;
    newListings: number;
    changedListings: number;
    removedListings: number;
    alertsCreated: number;
    kgChanges: number;
    portalsCrawled?: number;
    portalsSkipped?: number;
    durationMs?: number;
  };
  evidence?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AlertSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AlertCategory =
  | 'new_listing'
  | 'listing_removed'
  | 'price_drop'
  | 'price_increase'
  | 'broker_change'
  | 'inventory_up'
  | 'inventory_down'
  | 'relisted'
  | 'stale_listing'
  | 'duplicate_removed'
  | 'portal_added'
  | 'portal_removed'
  | 'amenities_changed'
  | 'description_changed'
  | 'images_changed'
  | 'availability_changed'
  | 'configuration_changed'
  | 'project_momentum'
  | 'builder_launch'
  | 'insight';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ResearchNotification = {
  id: string;
  workspaceId: string;
  watchId?: string;
  jobId?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  priority: NotificationPriority;
  title: string;
  body: string;
  read: boolean;
  archived: boolean;
  propertyId?: string;
  projectId?: string;
  brokerId?: string;
  localityId?: string;
  builderId?: string;
  /** Evidence + timeline + KG links. */
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TrendEntityType =
  | 'property'
  | 'project'
  | 'builder'
  | 'broker'
  | 'locality'
  | 'city'
  | 'workspace';

export type TrendSnapshot = {
  id: string;
  workspaceId: string;
  entityType: TrendEntityType;
  entityId: string;
  entityLabel: string;
  inventoryDeltaPct: number | null;
  averageRentDelta: number | null;
  averageSaleDelta: number | null;
  priceVelocity: number | null;
  brokerActivity: number;
  marketActivity: number;
  listingFreshnessDays: number | null;
  portalDistribution: Record<string, number>;
  priceVolatility: number | null;
  momentumScore: number;
  windowDays: number;
  sampleSize: number;
  evidence: Record<string, unknown>;
  computedAt: string;
  createdAt: string;
};

export type MarketWatchDashboard = {
  activeWatches: number;
  scheduledJobs: number;
  jobsRunning: number;
  jobsQueued: number;
  jobsCompleted: number;
  jobsFailed: number;
  alertsToday: number;
  priceDrops: number;
  newListings: number;
  removedListings: number;
  inventoryChanges: number;
  marketMovementPct: number | null;
  knowledgeGraphGrowth: number;
  connectorHealth: Array<{ portal: string; status: string; latencyMs?: number | null }>;
  researchQueueDepth: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  backgroundWorkers: Array<{
    workerType: WatchJobWorkerType;
    status: 'online' | 'stale' | 'offline';
    lastHeartbeatAt?: string;
  }>;
  recentInsights: string[];
};

export type SystemHealthReport = {
  status: 'healthy' | 'degraded' | 'critical';
  checkedAt: string;
  jobSuccessRate24h: number | null;
  portalFailureRate24h: number | null;
  retryCount24h: number;
  alertThroughput24h: number;
  kgUpdateRate24h: number;
  browserCrashCount24h: number;
  avgConnectorLatencyMs: number | null;
  workers: Array<{
    workerType: WatchJobWorkerType;
    workerId: string;
    status: 'online' | 'stale' | 'offline';
    lastHeartbeatAt: string;
    metrics?: Record<string, unknown>;
  }>;
  connectors: Array<{ portal: string; status: string }>;
};

export type WorkerHeartbeat = {
  id: string;
  workspaceId?: string;
  workerId: string;
  workerType: WatchJobWorkerType;
  status: 'idle' | 'busy' | 'error';
  host?: string;
  metrics?: Record<string, unknown>;
  lastHeartbeatAt: string;
  createdAt: string;
  updatedAt: string;
};

export type MonitorAudit = {
  id: string;
  workspaceId: string;
  action: string;
  actorId?: string;
  watchId?: string;
  jobId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export type SmartCrawlPlan = {
  shouldCrawl: boolean;
  reason: string;
  portalsToCrawl: string[];
  portalsSkipped: Array<{ portal: string; reason: string }>;
  strategy: WatchSearchStrategy;
  knownPropertyCount: number;
  recentChangeCount: number;
  confidence: number;
  evidence: Record<string, unknown>;
};
