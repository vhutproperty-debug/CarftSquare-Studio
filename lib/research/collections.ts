/** Isolated Prop/Research MongoDB collection names. */

export const RESEARCH_COLLECTIONS = {
  portalConnections: 'research_portal_connections',
  queries: 'research_queries',
  runs: 'research_runs',
  results: 'research_results',
  savedSearches: 'research_saved_searches',
  browserSessions: 'research_browser_sessions',
  activityLogs: 'research_activity_logs',
  /** Phase 3 — conversational research memory + reports */
  aiSessions: 'research_ai_sessions',
  /** Phase 4 — Property Knowledge Graph */
  kgProperties: 'research_kg_properties',
  kgProjects: 'research_kg_projects',
  kgBuildings: 'research_kg_buildings',
  kgTowers: 'research_kg_towers',
  kgLocalities: 'research_kg_localities',
  kgBrokers: 'research_kg_brokers',
  kgBuilders: 'research_kg_builders',
  kgPortals: 'research_kg_portals',
  kgListings: 'research_kg_listings',
  kgEdges: 'research_kg_edges',
  kgObservations: 'research_kg_observations',
  kgChanges: 'research_kg_changes',
  kgTimeline: 'research_kg_timeline',
  kgAliases: 'research_kg_aliases',
  /** Phase 5 — continuous monitoring */
  watches: 'research_watches',
  watchJobs: 'research_watch_jobs',
  notifications: 'research_notifications',
  trends: 'research_trends',
  monitorAudits: 'research_monitor_audits',
  workerHeartbeats: 'research_worker_heartbeats',
  monitorMetrics: 'research_monitor_metrics',
  /** Connector UX — remote browser connect sessions (no Playwright in Next.js) */
  connectSessions: 'research_connect_sessions',
} as const;

export type ResearchCollectionName =
  (typeof RESEARCH_COLLECTIONS)[keyof typeof RESEARCH_COLLECTIONS];
