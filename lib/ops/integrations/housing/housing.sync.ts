import { v4 as uuidv4 } from 'uuid';
import type { DemandConnector } from '@/lib/ops/integrations/connector.types';
import { validateHousingConfig, isHousingApiConfigured } from '@/lib/env/housing';
import { ensureDemandRecord } from '@/lib/ops/demand/store';
import {
  fetchHousingLeadsWithStatus,
  verifyHousingConnection,
} from '@/lib/ops/integrations/housing/housing.client';
import { detectHousingDuplicate } from '@/lib/ops/integrations/housing/housing.dedupe';
import { buildHousingExternalLeadId, mapHousingApiLead } from '@/lib/ops/integrations/housing/housing.mapper';
import { normalizeHousingDemand } from '@/lib/ops/integrations/housing/housing.normalizer';
import {
  completeHousingSyncLog,
  countHousingFailedRecords,
  countHousingRawRecords,
  countHousingRawToday,
  createHousingSyncLog,
  getHousingDatabase,
  getLastSuccessfulHousingSyncLog,
  getLatestHousingAuthLog,
  getLatestHousingSyncLog,
  markHousingRawFailed,
  upsertHousingRawRecord,
} from '@/lib/ops/integrations/housing/housing.service';
import {
  HOUSING_CONNECTOR_ID,
  HOUSING_SOURCE,
  type HousingConnectorStatusSnapshot,
  type HousingSyncCounters,
  type HousingSyncOutcome,
  type HousingTestConnectionResult,
} from '@/lib/ops/integrations/housing/housing.types';
import { housingRawToLead } from '@/lib/ops/leads/adapters/housing-api';
import type { OpsLeadSource } from '@/lib/ops/leads/types';

async function importHousingLead(
  db: Awaited<ReturnType<typeof getHousingDatabase>>,
  counters: HousingSyncCounters,
  triggeredBy: string,
  mapped: ReturnType<typeof mapHousingApiLead>,
): Promise<void> {
  const provisional = normalizeHousingDemand(mapped.externalLeadId, uuidv4(), mapped.payload);
  const dedupe = await detectHousingDuplicate(db, provisional);
  const rawId = dedupe.action === 'update' ? dedupe.existingRawId : uuidv4();
  const normalized = normalizeHousingDemand(mapped.externalLeadId, rawId, mapped.payload);
  const importedAt = new Date().toISOString();

  await upsertHousingRawRecord(db, {
    id: rawId,
    externalLeadId: mapped.externalLeadId,
    payload: mapped.payload,
    normalized,
    syncState: 'imported',
    importedAt,
    lastError: null,
  });

  const lead = housingRawToLead({
    id: rawId,
    externalLeadId: mapped.externalLeadId,
    payload: mapped.payload,
    normalized,
    syncState: 'imported',
    fetchedAt: importedAt,
    updatedAt: importedAt,
    importedAt,
  });

  await ensureDemandRecord(db, lead, triggeredBy);

  if (dedupe.action === 'update') {
    counters.updated += 1;
    if (dedupe.reason !== 'externalLeadId') {
      counters.duplicates += 1;
    }
  } else {
    counters.imported += 1;
  }
}

/**
 * Prefer incremental sync after a modern chunked success.
 * Legacy "completed with 0 leads" YMD syncs are ignored so we backfill once.
 */
async function resolveHousingSyncWindow(
  db: Awaited<ReturnType<typeof getHousingDatabase>>,
): Promise<{ since?: string; days?: number }> {
  const lastSuccessful = await getLastSuccessfulHousingSyncLog(db);
  const usedChunkedClient = (lastSuccessful?.chunksAttempted ?? 0) > 0;
  if (lastSuccessful?.completedAt && usedChunkedClient) {
    const since = new Date(lastSuccessful.completedAt);
    // One-day overlap so chunk boundaries and clock skew cannot drop leads.
    since.setTime(since.getTime() - 24 * 60 * 60 * 1000);
    return { since: since.toISOString() };
  }
  return { days: 90 };
}

function emptyCounters(): HousingSyncCounters {
  return {
    leadsFetched: 0,
    imported: 0,
    updated: 0,
    duplicates: 0,
    failed: 0,
    errors: [],
    chunksAttempted: 0,
    chunksCompleted: 0,
  };
}

function configErrorOutcome(
  logId: string,
  durationMs: number,
  message: string,
): HousingSyncOutcome {
  return {
    success: false,
    authOk: false,
    apiResponseStatus: null,
    error: message,
    logId,
    durationMs,
    leadsFetched: 0,
    imported: 0,
    updated: 0,
    duplicates: 0,
    failed: 0,
    errors: [{ message }],
    chunksAttempted: 0,
    chunksCompleted: 0,
    zeroResult: false,
    partial: false,
  };
}

export async function runHousingSync(triggeredBy: string): Promise<HousingSyncOutcome> {
  const started = Date.now();
  const db = await getHousingDatabase();
  const log = await createHousingSyncLog(db, triggeredBy, 'sync');
  const counters = emptyCounters();

  const validation = validateHousingConfig();
  if (!validation.ok) {
    const message = `Missing Housing credentials: ${validation.missing.join(', ')}`;
    const durationMs = Date.now() - started;
    counters.errors.push({ message });
    await completeHousingSyncLog(db, log.id, {
      ...counters,
      durationMs,
      status: 'failed',
      authOk: false,
      apiResponseStatus: null,
      lastErrorMessage: message,
      zeroResult: false,
    });
    return configErrorOutcome(log.id, durationMs, message);
  }

  const fetchResult = await fetchHousingLeadsWithStatus(
    await resolveHousingSyncWindow(db),
  );

  counters.chunksAttempted = fetchResult.chunksAttempted;
  counters.chunksCompleted = fetchResult.chunksCompleted;
  counters.leadsFetched = fetchResult.leads.length;

  if (!fetchResult.ok && fetchResult.leads.length === 0) {
    const message = fetchResult.errorMessage || 'Housing API fetch failed.';
    const durationMs = Date.now() - started;
    counters.errors.push({ message });
    await completeHousingSyncLog(db, log.id, {
      ...counters,
      durationMs,
      status: 'failed',
      authOk: false,
      apiResponseStatus: fetchResult.httpStatus || null,
      lastErrorMessage: message,
      zeroResult: false,
    });
    return {
      success: false,
      authOk: false,
      apiResponseStatus: fetchResult.httpStatus || null,
      error: message,
      logId: log.id,
      durationMs,
      zeroResult: false,
      partial: false,
      ...counters,
    };
  }

  if (!fetchResult.ok && fetchResult.leads.length > 0) {
    counters.errors.push({
      message: fetchResult.errorMessage || 'One or more Housing date chunks failed.',
    });
  }

  for (const apiLead of fetchResult.leads) {
    try {
      const mapped = mapHousingApiLead(apiLead);
      await importHousingLead(db, counters, triggeredBy, mapped);
    } catch (error) {
      counters.failed += 1;
      const message = error instanceof Error ? error.message : 'Unknown import error';
      let externalLeadId = 'unknown';
      try {
        externalLeadId = buildHousingExternalLeadId(apiLead);
      } catch {
        externalLeadId = 'unmappable';
      }
      counters.errors.push({ externalLeadId, message });
      try {
        await markHousingRawFailed(db, externalLeadId, { ...apiLead }, message);
      } catch {
        // Keep sync running even if failure persistence fails.
      }
    }
  }

  const durationMs = Date.now() - started;
  const chunksFullyOk = counters.chunksCompleted === counters.chunksAttempted
    && counters.chunksAttempted > 0;
  const importFullyOk = counters.failed === 0;
  const success = chunksFullyOk && importFullyOk && fetchResult.ok;
  const partial = !success && (counters.imported > 0 || counters.updated > 0);
  const zeroResult = success && counters.leadsFetched === 0;
  const lastErrorMessage = counters.errors[0]?.message
    ?? (zeroResult ? 'Housing API returned zero leads for the requested window.' : null);

  await completeHousingSyncLog(db, log.id, {
    ...counters,
    durationMs,
    status: success ? 'completed' : 'failed',
    authOk: fetchResult.httpStatus === 200 || fetchResult.ok,
    apiResponseStatus: fetchResult.httpStatus || null,
    lastErrorMessage,
    zeroResult,
  });

  return {
    success,
    authOk: fetchResult.httpStatus === 200 || fetchResult.ok,
    apiResponseStatus: fetchResult.httpStatus || null,
    error: success ? undefined : (lastErrorMessage || 'Housing sync failed.'),
    logId: log.id,
    durationMs,
    zeroResult,
    partial,
    ...counters,
  };
}

export async function runHousingTestConnection(triggeredBy: string): Promise<HousingTestConnectionResult> {
  const started = Date.now();
  const db = await getHousingDatabase();
  const log = await createHousingSyncLog(db, triggeredBy, 'test');

  const validation = validateHousingConfig();
  if (!validation.ok) {
    const message = `Missing Housing credentials: ${validation.missing.join(', ')}`;
    const durationMs = Date.now() - started;
    await completeHousingSyncLog(db, log.id, {
      durationMs,
      status: 'failed',
      authOk: false,
      apiResponseStatus: null,
      lastErrorMessage: message,
      errors: [{ message }],
      leadsFetched: 0,
      imported: 0,
      updated: 0,
      duplicates: 0,
      failed: 0,
      chunksAttempted: 0,
      chunksCompleted: 0,
      zeroResult: false,
    });
    return {
      success: false,
      authOk: false,
      apiResponseStatus: null,
      error: message,
      logId: log.id,
      durationMs,
      leadsAvailable: 0,
    };
  }

  const result = await verifyHousingConnection();
  const durationMs = Date.now() - started;

  if (!result.ok) {
    const message = result.errorMessage || 'Housing API authentication failed.';
    await completeHousingSyncLog(db, log.id, {
      durationMs,
      status: 'failed',
      authOk: false,
      apiResponseStatus: result.httpStatus || null,
      lastErrorMessage: message,
      errors: [{ message }],
      leadsFetched: 0,
      imported: 0,
      updated: 0,
      duplicates: 0,
      failed: 0,
      chunksAttempted: result.chunksAttempted,
      chunksCompleted: result.chunksCompleted,
      zeroResult: false,
    });
    return {
      success: false,
      authOk: false,
      apiResponseStatus: result.httpStatus || null,
      error: message,
      logId: log.id,
      durationMs,
      leadsAvailable: 0,
    };
  }

  await completeHousingSyncLog(db, log.id, {
    durationMs,
    status: 'completed',
    authOk: true,
    apiResponseStatus: result.httpStatus,
    lastErrorMessage: result.zeroResult
      ? 'Housing API returned zero leads for the 1-day test window.'
      : null,
    errors: [],
    leadsFetched: result.leads.length,
    imported: 0,
    updated: 0,
    duplicates: 0,
    failed: 0,
    chunksAttempted: result.chunksAttempted,
    chunksCompleted: result.chunksCompleted,
    zeroResult: Boolean(result.zeroResult),
  });

  return {
    success: true,
    authOk: true,
    apiResponseStatus: result.httpStatus,
    logId: log.id,
    durationMs,
    leadsAvailable: result.leads.length,
  };
}

export async function getHousingConnectorStatus(): Promise<HousingConnectorStatusSnapshot> {
  const db = await getHousingDatabase();
  const validation = validateHousingConfig();
  const [latest, lastSuccessful, latestAuth] = await Promise.all([
    getLatestHousingSyncLog(db),
    getLastSuccessfulHousingSyncLog(db),
    getLatestHousingAuthLog(db),
  ]);
  const [totalLeads, importedToday, updatedToday, failedRecords] = await Promise.all([
    countHousingRawRecords(db),
    countHousingRawToday(db, 'importedAt'),
    countHousingRawToday(db, 'updatedAt'),
    countHousingFailedRecords(db),
  ]);

  const duplicateRecords = latest?.kind === 'sync' ? (latest.duplicates ?? 0) : 0;
  const lastSyncAt = latest?.kind === 'sync'
    ? (latest.completedAt ?? latest.startedAt ?? null)
    : (latest?.completedAt ?? latest?.startedAt ?? null);
  const authenticated = latestAuth?.authOk === true;
  const connectionStatus = !validation.ok
    ? 'misconfigured'
    : authenticated
      ? 'connected'
      : 'not_connected';

  const lastErrorMessage = latestAuth?.lastErrorMessage
    ?? latestAuth?.errors?.[0]?.message
    ?? null;

  return {
    connectorId: HOUSING_CONNECTOR_ID,
    label: 'Housing.com',
    configured: validation.ok,
    authenticated,
    connectionStatus,
    lastSyncAt,
    lastSuccessfulSyncAt: lastSuccessful?.completedAt ?? null,
    lastSyncDurationMs: latest?.kind === 'sync' ? (latest.durationMs ?? null) : null,
    totalLeads,
    leadsImportedLastSync: lastSuccessful?.imported ?? null,
    importedToday,
    updatedToday,
    failedRecords,
    duplicateRecords,
    apiResponseStatus: latestAuth?.apiResponseStatus ?? null,
    lastErrorMessage,
    message: validation.ok
      ? undefined
      : `Missing: ${validation.missing.join(', ')}`,
  };
}

export const housingConnector: DemandConnector = {
  id: HOUSING_CONNECTOR_ID,
  label: 'Housing.com',
  sync: async (triggeredBy) => {
    const result = await runHousingSync(triggeredBy);
    if (!result.success) {
      throw new Error(result.error || 'Housing sync failed.');
    }
    return result;
  },
  getStatus: async () => {
    const status = await getHousingConnectorStatus();
    return {
      connectorId: status.connectorId,
      label: status.label,
      connectionStatus: status.connectionStatus === 'connected'
        ? 'connected'
        : status.connectionStatus === 'misconfigured'
          ? 'misconfigured'
          : 'error',
      configured: status.configured,
      lastSyncAt: status.lastSyncAt,
      lastSyncDurationMs: status.lastSyncDurationMs,
      totalLeads: status.totalLeads,
      importedToday: status.importedToday,
      updatedToday: status.updatedToday,
      failedRecords: status.failedRecords,
      duplicateRecords: status.duplicateRecords,
      message: status.message,
    };
  },
};

export function isHousingLeadSource(source: OpsLeadSource): boolean {
  return source === HOUSING_SOURCE;
}

export function housingConnectorConfigured(): boolean {
  return isHousingApiConfigured();
}
