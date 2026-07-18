import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { executiveResearchAgent } from '@/lib/research/ai/executive-research-agent';
import { requireResearchViewAccess } from '@/lib/research/auth';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const session = await executiveResearchAgent.getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const listingIds = Array.isArray(body.listingIds)
      ? body.listingIds.filter((x: unknown) => typeof x === 'string')
      : undefined;
    const comparison = executiveResearchAgent.compareSessionListings(session, listingIds);
    return NextResponse.json({ ok: true, comparison });
  } catch (error) {
    console.error('[research] ai_compare_failed', error);
    return NextResponse.json({ error: 'Comparison failed.' }, { status: 500 });
  }
}
