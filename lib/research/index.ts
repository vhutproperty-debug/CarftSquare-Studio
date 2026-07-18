export { RESEARCH_MODULE } from '@/lib/research/permissions';
export { requireResearchViewAccess, requireResearchEditAccess } from '@/lib/research/auth';
export { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
export {
  RESEARCH_PRODUCT,
  RESEARCH_NAV_ITEMS,
  DEFAULT_RESEARCH_WORKSPACE,
  RESEARCH_DASHBOARD_PLACEHOLDERS,
} from '@/lib/research/business';
export { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
export { researchBrowserManager, RESEARCH_PORTALS } from '@/lib/research/browser';
export { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';
export { researchPlanner } from '@/lib/research/planner/research-planner';
export { researchExecutionEngine } from '@/lib/research/execution/research-execution-engine';
export {
  executiveResearchAgent,
  researchBrowserAgent,
  understandResearchIntent,
  dedupeAcrossPortals,
  scoreListings,
  buildResearchReport,
} from '@/lib/research/ai';
export {
  enrichKnowledgeGraph,
  advancedKnowledgeSearch,
  parseAdvancedKnowledgeQuery,
  getKnowledgeDashboardStats,
  queryKnownProperties,
} from '@/lib/research/graph';
export {
  createWatch,
  listWatches,
  runMonitorTick,
  runWatchNow,
  getMarketWatchDashboard,
  listNotifications,
  listTrends,
  buildProactiveInsights,
  planWatchCrawl,
  getSystemHealthReport,
  listWorkerHeartbeats,
} from '@/lib/research/monitoring';
export type * from '@/lib/research/types';
export type * from '@/lib/research/graph/types';
export type * from '@/lib/research/monitoring/types';
