import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth/require-admin-api';
import { mergeModulePricing } from '@/lib/estimate/pricing-engine';
import { quotationPricingSaveSchema } from '@/lib/estimate/schemas';
import { getDatabase, getModulePricing, saveModulePricing, seedDefaultPricing } from '@/lib/estimate/store';
import type { EstimateModuleId } from '@/lib/estimate/types';

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const moduleId = (searchParams.get('moduleId') || 'home-interior') as EstimateModuleId;
  const db = await getDatabase();
  await seedDefaultPricing(db);
  const config = await getModulePricing(db, moduleId);
  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const body = await request.json();
  const parsed = quotationPricingSaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const db = await getDatabase();
  const config = mergeModulePricing(parsed.data.config, parsed.data.moduleId as EstimateModuleId);
  config.key = `quotation_pricing_${parsed.data.moduleId}`;
  config.moduleId = parsed.data.moduleId as EstimateModuleId;
  await saveModulePricing(db, config);
  return NextResponse.json({ config, message: 'Pricing saved.' });
}
