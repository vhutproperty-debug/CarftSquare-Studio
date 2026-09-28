import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { generateCreativePack } from '@/lib/meta-ads/creative-generator';
import { getMetaAdsDatabase, insertCreatives, listCreatives } from '@/lib/meta-ads/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const db = await getMetaAdsDatabase();
    const creatives = await listCreatives(db);
    return NextResponse.json({ creatives });
  } catch (error) {
    console.error('[ops-ads] creatives_list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to list creatives.' }, { status: 500 });
  }
}

const generateSchema = z.object({
  offer: z.string().trim().min(8).max(300),
  audienceHint: z.string().trim().max(120).optional(),
  areas: z.array(z.string().trim().min(2).max(80)).max(8).optional(),
  count: z.number().int().min(1).max(8).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const pack = generateCreativePack(parsed.data);
    const db = await getMetaAdsDatabase();
    const creatives = await insertCreatives(
      db,
      pack.map((row) => ({
        ...row,
        createdBy: auth.admin.id,
      })),
    );

    await logOpsActivity({
      action: 'meta_ads_generate_creatives',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_meta_ad_creatives',
      details: { count: creatives.length, offer: parsed.data.offer },
      request,
    });

    return NextResponse.json({ creatives }, { status: 201 });
  } catch (error) {
    console.error('[ops-ads] creatives_generate_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to generate creatives.' }, { status: 500 });
  }
}
