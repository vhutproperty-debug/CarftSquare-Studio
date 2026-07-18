export type * from '@/lib/research/graph/types';
export { enrichKnowledgeGraph } from '@/lib/research/graph/enrichment';
export {
  parseAdvancedKnowledgeQuery,
  advancedKnowledgeSearch,
} from '@/lib/research/graph/advanced-search';
export {
  queryKnownProperties,
  kgPropertiesToListings,
  getPropertyTimeline,
  getPropertyObservations,
  getPropertyPriceHistory,
  getPropertyChanges,
  getGraphRelationships,
  getKnowledgeDashboardStats,
  findProjectByName,
  findBrokerByName,
} from '@/lib/research/graph/query';
export {
  getPropertyById,
  getProjectById,
  getBrokerById,
  getLocalityById,
} from '@/lib/research/graph/entity-store';
export { buildIdentityFingerprints } from '@/lib/research/graph/identity';
export { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
export {
  resolveCanonicalName,
  registerAlias,
  listAliases,
  ensureBuiltinAliases,
} from '@/lib/research/graph/aliases';
export { scoreIdentityMatch, isConfidentMatch } from '@/lib/research/graph/confidence';
export {
  fingerprintImage,
  fingerprintImageUrls,
  extractImageUrlsFromListing,
} from '@/lib/research/graph/image-fingerprint';
export { getExplorerProjects, getExplorerTree } from '@/lib/research/graph/explorer';
export type { KgExplorerNode } from '@/lib/research/graph/explorer';
