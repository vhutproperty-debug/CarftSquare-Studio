import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes } from '@/lib/research/store';

export const runtime = 'nodejs';

/** Lightweight foundation health check for Prop/Research. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    await ensureResearchIndexes();
    return NextResponse.json({
      ok: true,
      product: 'Prop/Research',
      collections: Object.values(RESEARCH_COLLECTIONS),
    });
  } catch (error) {
    console.error('[research] health_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Research health check failed.' }, { status: 500 });
  }
}
