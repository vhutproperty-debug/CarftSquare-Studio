export type * from '@/lib/research/monitoring/types';
export {
  createWatch,
  getWatchById,
  listWatches,
  updateWatch,
  deleteWatch,
  listDueWatches,
  computeNextRunAt,
  markWatchEventDue,
  deriveWatchHealth,
} from '@/lib/research/monitoring/watch-store';
export { publicWatch } from '@/lib/research/monitoring/watch-crypto';
export {
  enqueueWatchJob,
  getJobById,
  listJobs,
  claimNextJob,
  countJobsByStatus,
} from '@/lib/research/monitoring/job-queue';
export {
  listNotifications,
  getNotificationById,
  markNotificationRead,
  archiveNotification,
  bulkUpdateNotifications,
  countUnread,
  createNotification,
} from '@/lib/research/monitoring/notification-store';
export { runMonitorTick, runWatchNow, scheduleDueWatches, processNextWatchJob } from '@/lib/research/monitoring/worker';
export { computeWorkspaceTrends, listTrends } from '@/lib/research/monitoring/trend-engine';
export { buildProactiveInsights } from '@/lib/research/monitoring/insights';
export { getMarketWatchDashboard } from '@/lib/research/monitoring/dashboard';
export { planWatchCrawl } from '@/lib/research/monitoring/smart-planner';
export {
  recordWorkerHeartbeat,
  listWorkerHeartbeats,
  getSystemHealthReport,
} from '@/lib/research/monitoring/worker-health';
export { ensureMonitoringIndexes } from '@/lib/research/monitoring/indexes';
