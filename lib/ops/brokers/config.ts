/**
 * Centralized Broker Inventory Intelligence configuration (V2).
 * All business thresholds live here — do not hardcode in components/services.
 */

export const BROKER_IMPORT_CONFIG = {
  /** Max WhatsApp export size (bytes). */
  maxFileBytes: 12 * 1024 * 1024,
  allowedExtensions: ['.txt'] as const,
  allowedMimeTypes: ['text/plain', 'application/octet-stream', ''] as const,
  /** Persist raw messages in chunks during import. */
  rawInsertChunkSize: 250,
  /** Process inventory candidates in checkpoint windows. */
  candidateCheckpointSize: 50,
  /** Page size when loading candidates from Mongo (avoids unbounded toArray). */
  candidatePageSize: 200,
  /** Max processing errors retained on a batch. */
  maxStoredErrors: 50,
  /** Max source message IDs retained on an inventory document. */
  maxSourceMessageIds: 50,
  /** Reject reclaim of PROCESSING batches newer than this (ms). */
  processingLeaseMs: 15 * 60 * 1000,
} as const;

/** Freshness thresholds (days since lastSeenAt). */
export const BROKER_FRESHNESS_CONFIG = {
  freshMaxDays: 7,
  agingMaxDays: 14,
} as const;

/** Minimum real-estate signal score to treat a message as a listing candidate. */
export const LISTING_DETECTION_CONFIG = {
  minSignalScore: 3,
} as const;

/**
 * Confidence component weights (must sum to 1).
 * overallConfidence = weighted sum of component scores (0–100 each).
 */
export const CONFIDENCE_WEIGHTS = {
  parser: 0.15,
  project: 0.3,
  configuration: 0.2,
  price: 0.25,
  phone: 0.1,
} as const;

/** Review / merge routing thresholds. */
export const REVIEW_CONFIG = {
  /** Below this overall confidence → always review (or create cautiously). */
  lowConfidenceMax: 45,
  /** Mid-band overall confidence → review before merge/create. */
  reviewBandMin: 46,
  reviewBandMax: 72,
  /** Auto-merge only when overall ≥ this AND dedupe confidence ≥ mergeMin. */
  autoMergeMinOverall: 73,
  /** Dedupe match confidence mid-band → review instead of merge. */
  dedupeReviewMin: 40,
  dedupeReviewMax: 75,
  /** Auto-merge requires dedupe confidence ≥ this. */
  dedupeAutoMergeMin: 76,
  /** Relative rent conflict that forces review (e.g. 0.2 = 20%). */
  rentConflictRatio: 0.2,
} as const;

/** Unknown / unmapped project rules. */
export const PROJECT_ALIAS_CONFIG = {
  /** Persist unknown project sightings for the Unmapped Projects report. */
  trackUnknownProjects: true,
  /** Do not auto-create aliases for unknown names. */
  autoCreateAliases: false,
} as const;

/** Seed aliases used only to bootstrap ops_project_aliases when empty. */
export const PROJECT_ALIAS_SEED: Array<{
  canonicalProject: string;
  aliases: string[];
  city: string;
  locality?: string;
  builder?: string;
}> = [
  {
    canonicalProject: 'Oberoi Sky City',
    aliases: ['oberoi sky city', 'oberoi skycity', 'sky city', 'skycity', 'oberoi sky-city', 'osc'],
    city: 'Mumbai',
    locality: 'Borivali East',
    builder: 'Oberoi',
  },
  {
    canonicalProject: 'Hiranandani Gardens',
    aliases: ['hiranandani gardens', 'hiranandani', 'powai hiranandani'],
    city: 'Mumbai',
    locality: 'Powai',
    builder: 'Hiranandani',
  },
  {
    canonicalProject: 'Lodha Palava',
    aliases: ['lodha palava', 'palava', 'palava city'],
    city: 'Mumbai',
    locality: 'Dombivli',
    builder: 'Lodha',
  },
  {
    canonicalProject: 'Runwal Forest',
    aliases: ['runwal forest', 'runwal forests'],
    city: 'Mumbai',
    builder: 'Runwal',
  },
  {
    canonicalProject: 'Kalpataru Immensa',
    aliases: ['kalpataru immensa', 'immensa'],
    city: 'Mumbai',
    builder: 'Kalpataru',
  },
  {
    canonicalProject: 'Wadhwa Atmosphere',
    aliases: ['wadhwa atmosphere', 'atmosphere'],
    city: 'Mumbai',
    builder: 'Wadhwa',
  },
  {
    canonicalProject: 'Rustomjee Urbania',
    aliases: ['rustomjee urbania', 'urbania'],
    city: 'Mumbai',
    builder: 'Rustomjee',
  },
  {
    canonicalProject: 'Piramal Revanta',
    aliases: ['piramal revanta', 'revanta'],
    city: 'Mumbai',
    builder: 'Piramal',
  },
  {
    canonicalProject: 'Kanakia Sevens',
    aliases: ['kanakia sevens', 'sevens'],
    city: 'Mumbai',
    builder: 'Kanakia',
  },
];
