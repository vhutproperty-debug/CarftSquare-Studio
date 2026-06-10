import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
// @ts-expect-error JS module without types
import { getDb } from '@/lib/mongodb';
import { DEFAULT_MODULE_PRICING } from './defaults';
import type {
  EstimateModuleId,
  ModulePricingConfig,
  QuotationLead,
  QuotationQuote,
} from './types';
import { mergeModulePricing } from './pricing-engine';

export async function getDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureQuotationIndexes(db: Db): Promise<void> {
  await db.collection('quotation_quotes').createIndex({ id: 1 }, { unique: true });
  await db.collection('quotation_quotes').createIndex({ quoteNumber: 1 }, { unique: true });
  await db.collection('quotation_quotes').createIndex({ createdAt: -1 });
  await db.collection('quotation_quotes').createIndex({ moduleId: 1 });
  await db.collection('quotation_quotes').createIndex({ status: 1 });
  await db.collection('quotation_quotes').createIndex({ leadSource: 1 });
  await db.collection('quotation_quotes').createIndex({ 'customer.phone': 1 });
  await db.collection('quotation_quotes').createIndex({ 'customer.name': 1 });
  await db.collection('quotation_quotes').createIndex({ 'answers.city': 1 });
  await db.collection('quotation_settings').createIndex({ key: 1 }, { unique: true });
}

export async function getModulePricing(db: Db, moduleId: EstimateModuleId): Promise<ModulePricingConfig> {
  const key = `quotation_pricing_${moduleId}`;
  const stored = await db.collection('quotation_settings').findOne({ key }, { projection: { _id: 0 } });
  return mergeModulePricing(stored as Partial<ModulePricingConfig> | null, moduleId);
}

export async function saveModulePricing(db: Db, config: ModulePricingConfig): Promise<void> {
  await db.collection('quotation_settings').updateOne(
    { key: config.key },
    { $set: { ...config, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
}

export async function seedDefaultPricing(db: Db): Promise<void> {
  for (const moduleId of Object.keys(DEFAULT_MODULE_PRICING) as EstimateModuleId[]) {
    const key = `quotation_pricing_${moduleId}`;
    const exists = await db.collection('quotation_settings').findOne({ key });
    if (!exists) {
      await saveModulePricing(db, DEFAULT_MODULE_PRICING[moduleId]);
    }
  }
}

function generateQuoteNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `CSS-${y}${m}${d}-${rand}`;
}

export async function createQuoteRecord(
  db: Db,
  payload: Omit<QuotationQuote, 'id' | 'quoteNumber' | 'createdAt' | 'updatedAt' | 'pdfStored' | 'status'>,
): Promise<QuotationQuote> {
  const now = new Date().toISOString();
  const quote: QuotationQuote = {
    ...payload,
    id: uuidv4(),
    quoteNumber: generateQuoteNumber(),
    pdfStored: false,
    status: 'new',
    notes: payload.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('quotation_quotes').insertOne(quote);
  return quote;
}

export async function getQuoteById(db: Db, id: string): Promise<QuotationQuote | null> {
  return db.collection('quotation_quotes').findOne({ id }, { projection: { _id: 0 } }) as Promise<QuotationQuote | null>;
}

export async function updateQuote(db: Db, id: string, patch: Partial<QuotationQuote>): Promise<QuotationQuote | null> {
  const updatedAt = new Date().toISOString();
  await db.collection('quotation_quotes').updateOne({ id }, { $set: { ...patch, updatedAt } });
  return getQuoteById(db, id);
}

export async function findRecentQuoteByPhone(
  db: Db,
  phone: string,
  withinMinutes = 30,
): Promise<QuotationQuote | null> {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (!digits) return null;
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const quotes = (await db
    .collection('quotation_quotes')
    .find(
      {
        createdAt: { $gte: since },
        'customer.phone': { $regex: digits },
      },
      { projection: { _id: 0 } },
    )
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray()) as QuotationQuote[];
  return quotes[0] || null;
}

export function toQuotationLead(quote: QuotationQuote): QuotationLead {
  return {
    ...quote,
    projectType: quote.aiSummary.projectType,
    area: Number(quote.answers.carpetArea) || 0,
    budget: quote.aiSummary.budget,
  };
}
