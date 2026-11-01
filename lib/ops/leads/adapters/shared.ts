import type { Db } from 'mongodb';
import type { NormalizedOpsLead, OpsLeadSource } from '@/lib/ops/leads/types';

export type AdapterQueryFilters = {
  limit: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type LeadSourceAdapter = {
  source: OpsLeadSource;
  collection: string;
  fetchLeads: (db: Db, filters: AdapterQueryFilters) => Promise<NormalizedOpsLead[]>;
  fetchLeadById: (db: Db, id: string) => Promise<NormalizedOpsLead | null>;
  countLeads: (db: Db, filters: Omit<AdapterQueryFilters, 'limit'>) => Promise<number>;
};

const ADAPTER_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function runAdapterSafely<T>(
  source: OpsLeadSource,
  fn: () => Promise<T>,
  fallback: T,
): Promise<{ value: T; status: 'ok' | 'error' }> {
  try {
    const value = await withTimeout(fn(), ADAPTER_TIMEOUT_MS, `adapter_${source}`);
    return { value, status: 'ok' };
  } catch (error) {
    console.error(
      `[ops-leads] adapter_${source}_failed`,
      error instanceof Error ? error.message : error,
    );
    return { value: fallback, status: 'error' };
  }
}

export async function collectionExists(db: Db, name: string): Promise<boolean> {
  try {
    const collections = await db.listCollections({ name }, { nameOnly: true }).toArray();
    return collections.length > 0;
  } catch {
    return false;
  }
}
