export type KgPropertyStatus = 'active' | 'removed' | 'unknown' | 'relisted';

export type KgIdentityKeys = {
  /** Stable fingerprint used for deterministic identity resolution. */
  fingerprint: string;
  /** Secondary fingerprints for fuzzy rematch. */
  altFingerprints: string[];
};

export type KgProperty = {
  id: string;
  workspaceId: string;
  identity: KgIdentityKeys;
  projectId?: string;
  buildingId?: string;
  towerId?: string;
  localityId?: string;
  brokerId?: string;
  builderId?: string;
  title?: string;
  projectName?: string;
  buildingName?: string;
  tower?: string;
  wing?: string;
  unit?: string;
  floor?: string;
  facing?: string;
  configuration?: string;
  bhk?: number;
  carpetArea?: number;
  rent?: number;
  salePrice?: number;
  furnishing?: string;
  status: KgPropertyStatus;
  portalKeys: string[];
  portalUrls: string[];
  imageHashes: string[];
  /** Perceptual / media fingerprints (not raw URLs). */
  imageFingerprints: string[];
  externalAliases: string[];
  gps?: { lat: number; lng: number };
  amenities?: string[];
  availability?: string;
  identityConfidence?: {
    score: number;
    reason: string;
    matchingFactors: string[];
  };
  firstSeenAt: string;
  lastSeenAt: string;
  daysOnMarket: number;
  observationCount: number;
  listingFrequency: number;
  priceHistory: Array<{ at: string; rent?: number; salePrice?: number; portal?: string }>;
  brokerHistory: Array<{ at: string; brokerId?: string; brokerName?: string }>;
  portalHistory: Array<{ at: string; portal: string; url?: string }>;
  currentResearchSessionIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type KgProject = {
  id: string;
  workspaceId: string;
  name: string;
  nameKey: string;
  aliases?: string[];
  localityId?: string;
  localityName?: string;
  builderId?: string;
  builderName?: string;
  propertyCount: number;
  priceReductions7d?: number;
  availabilityChanges7d?: number;
  inventoryGrowthPct?: number | null;
  rentalInventory: number;
  saleInventory: number;
  averageRent?: number;
  averageSalePrice?: number;
  portalDistribution: Record<string, number>;
  topBrokerIds: string[];
  newListings7d: number;
  removedListings7d: number;
  inventoryTrend: Array<{ at: string; active: number }>;
  priceTrend: Array<{ at: string; averageRent?: number; averageSalePrice?: number }>;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type KgBuilding = {
  id: string;
  workspaceId: string;
  projectId?: string;
  name: string;
  nameKey: string;
  propertyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KgTower = {
  id: string;
  workspaceId: string;
  projectId?: string;
  buildingId?: string;
  name: string;
  nameKey: string;
  propertyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KgLocality = {
  id: string;
  workspaceId: string;
  name: string;
  nameKey: string;
  city?: string;
  propertyCount: number;
  averageRent?: number;
  averageSalePrice?: number;
  inventoryVolume: number;
  popularConfigurations: Record<string, number>;
  brokerConcentration: Record<string, number>;
  builderConcentration: Record<string, number>;
  priceMovement: Array<{ at: string; averageRent?: number; averageSalePrice?: number }>;
  marketActivity7d: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type KgBroker = {
  id: string;
  workspaceId: string;
  name: string;
  nameKey: string;
  /** Public listing-derived only — never private contact inventing. */
  activeListingCount: number;
  exclusiveInventoryCount: number;
  projectsCovered: string[];
  portals: string[];
  listingQualityScore: number;
  duplicateBehaviorScore: number;
  averagePricing?: number;
  responseFrequency: number;
  observationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type KgBuilder = {
  id: string;
  workspaceId: string;
  name: string;
  nameKey: string;
  projectIds: string[];
  propertyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type KgPortalNode = {
  id: string;
  workspaceId: string;
  key: string;
  displayName: string;
  listingCount: number;
  propertyCount: number;
  brokerCount: number;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type KgListingNode = {
  id: string;
  workspaceId: string;
  propertyId: string;
  portal: string;
  externalUrl?: string;
  externalListingId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: KgPropertyStatus;
  createdAt: string;
  updatedAt: string;
};

export type KgEdgeType =
  | 'property_project'
  | 'property_building'
  | 'property_tower'
  | 'property_broker'
  | 'property_locality'
  | 'property_builder'
  | 'broker_portal'
  | 'project_locality'
  | 'listing_property'
  | 'research_listing'
  | 'research_property'
  | 'observation_property'
  | 'observation_broker'
  | 'observation_portal';

export type KgEdge = {
  id: string;
  workspaceId: string;
  type: KgEdgeType;
  fromId: string;
  toId: string;
  confidenceScore?: number;
  confidenceReason?: string;
  matchingFactors?: string[];
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type KgObservation = {
  id: string;
  workspaceId: string;
  propertyId: string;
  listingId?: string;
  researchSessionId?: string;
  runId?: string;
  portal: string;
  url?: string;
  title?: string;
  rent?: number;
  salePrice?: number;
  brokerName?: string;
  brokerId?: string;
  furnishing?: string;
  facing?: string;
  availability?: string;
  amenities?: string[];
  descriptionSnippet?: string;
  imageHashes?: string[];
  imageFingerprints?: string[];
  rawListingId?: string;
  /** Full extracted payload for audit — never used as fabricated truth. */
  rawData?: Record<string, unknown>;
  observedAt: string;
  createdAt: string;
};

export type KgChangeType =
  | 'price_dropped'
  | 'price_increased'
  | 'broker_changed'
  | 'listing_removed'
  | 'listing_reappeared'
  | 'amenities_updated'
  | 'description_changed'
  | 'images_changed'
  | 'availability_changed'
  | 'portal_added'
  | 'portal_removed'
  | 'first_seen';

export type KgChange = {
  id: string;
  workspaceId: string;
  propertyId: string;
  type: KgChangeType;
  fromValue?: unknown;
  toValue?: unknown;
  portal?: string;
  researchSessionId?: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  createdAt: string;
};

export type KgTimelineEventType =
  | 'created'
  | 'first_seen'
  | 'price_reduced'
  | 'price_increased'
  | 'broker_changed'
  | 'removed'
  | 'relisted'
  | 'research_session'
  | 'latest_observation'
  | 'portal_added';

export type KgTimelineEvent = {
  id: string;
  workspaceId: string;
  propertyId: string;
  type: KgTimelineEventType;
  label: string;
  details?: Record<string, unknown>;
  at: string;
  createdAt: string;
};

export type KgEnrichmentResult = {
  propertiesUpserted: number;
  observationsAppended: number;
  changesDetected: number;
  brokersUpdated: number;
  projectsUpdated: number;
  localitiesUpdated: number;
};

export type KgAdvancedSearchQuery = {
  workspaceId: string;
  priceDrops?: boolean;
  priceIncreases?: boolean;
  minDaysOnMarket?: number;
  maxDaysOnMarket?: number;
  brokerExclusive?: boolean;
  newlyListedDays?: number;
  minPortals?: number;
  removedSinceDays?: number;
  relisted?: boolean;
  multipleBrokers?: boolean;
  increasingInventoryProjects?: boolean;
  projectName?: string;
  localityName?: string;
  bhk?: number;
  status?: KgPropertyStatus;
  limit?: number;
};

export type KgDashboardStats = {
  totalProperties: number;
  trackedProjects: number;
  trackedBrokers: number;
  historicalObservations: number;
  priceDropsDetected: number;
  newListings: number;
  removedListings: number;
  averageMarketMovementPct: number | null;
  knowledgeGraphGrowth7d: number;
};
