/**
 * Housing.com integration verification — sanitized counts only.
 * Usage: npx tsx scripts/housing-integration-run.ts
 */
import { loadEnvLocal } from './lib/load-env-local.mjs';
import { validateHousingConfig } from '../lib/env/housing';
import { verifyHousingConnection } from '../lib/ops/integrations/housing/housing.client';
import { runHousingSync, runHousingTestConnection } from '../lib/ops/integrations/housing/housing.sync';
import { getHousingDatabase } from '../lib/ops/integrations/housing/housing.service';
import { HOUSING_RAW_COLLECTION, HOUSING_SOURCE } from '../lib/ops/integrations/housing/housing.types';
import { housingApiAdapter } from '../lib/ops/leads/adapters/housing-api';

loadEnvLocal();

async function main() {
  const validation = validateHousingConfig();
  if (!validation.ok) {
    console.error('CONFIG_MISSING', validation.missing.join(', '));
    process.exit(1);
  }

  console.log('=== 1. Connection test ===');
  const test = await runHousingTestConnection('housing-fix-script');
  console.log(JSON.stringify({
    step: 'connection_test',
    success: test.success,
    httpStatus: test.apiResponseStatus,
    leadsAvailable: test.leadsAvailable ?? null,
    error: test.error ?? null,
  }));

  if (!test.success) process.exit(1);

  console.log('=== 2. API verify (1-day window) ===');
  const verify = await verifyHousingConnection();
  console.log(JSON.stringify({
    step: 'api_verify',
    ok: verify.ok,
    httpStatus: verify.httpStatus,
    leadsFetched: verify.leads.length,
    chunksAttempted: verify.chunksAttempted,
    chunksCompleted: verify.chunksCompleted,
    zeroResult: Boolean(verify.zeroResult),
  }));

  console.log('=== 3. Full sync ===');
  const sync1 = await runHousingSync('housing-verify-script');
  console.log(JSON.stringify({
    step: 'sync_initial',
    success: sync1.success,
    partial: sync1.partial,
    zeroResult: sync1.zeroResult,
    httpStatus: sync1.apiResponseStatus,
    chunksAttempted: sync1.chunksAttempted,
    chunksCompleted: sync1.chunksCompleted,
    leadsFetched: sync1.leadsFetched,
    imported: sync1.imported,
    updated: sync1.updated,
    duplicates: sync1.duplicates,
    failed: sync1.failed,
    errorCount: sync1.errors.length,
  }));

  console.log('=== 4. Incremental sync (idempotency) ===');
  const sync2 = await runHousingSync('housing-verify-script');
  console.log(JSON.stringify({
    step: 'sync_incremental',
    success: sync2.success,
    partial: sync2.partial,
    zeroResult: sync2.zeroResult,
    httpStatus: sync2.apiResponseStatus,
    chunksAttempted: sync2.chunksAttempted,
    chunksCompleted: sync2.chunksCompleted,
    leadsFetched: sync2.leadsFetched,
    imported: sync2.imported,
    updated: sync2.updated,
    duplicates: sync2.duplicates,
    failed: sync2.failed,
  }));

  console.log('=== 5. Storage + adapter readability ===');
  const db = await getHousingDatabase();
  const rawImported = await db.collection(HOUSING_RAW_COLLECTION).countDocuments({ syncState: 'imported' });
  const rawFailed = await db.collection(HOUSING_RAW_COLLECTION).countDocuments({ syncState: 'failed' });
  const demandHousing = await db.collection('ops_demand_records').countDocuments({ source: HOUSING_SOURCE });
  const adapterLeads = await housingApiAdapter.fetchLeads(db, { limit: 100 });
  const adapterReadable = adapterLeads.filter((lead) => lead.source === HOUSING_SOURCE).length;

  console.log(JSON.stringify({
    step: 'storage_adapter',
    ops_housing_raw_imported: rawImported,
    ops_housing_raw_failed: rawFailed,
    ops_demand_records_housing: demandHousing,
    housing_api_adapter_readable: adapterReadable,
  }));

  console.log('=== DONE ===');
  if (!sync1.success && !sync1.partial) process.exit(1);
}

main().catch((error) => {
  console.error('VERIFY_FAILED', error instanceof Error ? error.message : 'unknown');
  process.exit(1);
});
