import {
  getHousingConnectorStatus,
  runHousingSync,
  runHousingTestConnection,
} from '@/lib/ops/integrations/housing/housing.sync';
import {
  getHousingDatabase,
  listHousingSyncLogs,
} from '@/lib/ops/integrations/housing/housing.service';

export async function queryHousingIntegrationStatus() {
  return getHousingConnectorStatus();
}

export async function queryHousingIntegrationLogs(limit = 20) {
  const db = await getHousingDatabase();
  const logs = await listHousingSyncLogs(db, limit);
  return { logs };
}

export async function triggerHousingIntegrationSync(triggeredBy: string) {
  return runHousingSync(triggeredBy);
}

export async function triggerHousingIntegrationTest(triggeredBy: string) {
  return runHousingTestConnection(triggeredBy);
}
