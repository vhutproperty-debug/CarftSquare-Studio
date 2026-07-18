import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

/** Recent Knowledge Graph mutations from monitoring + research sessions. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);

  const [observations, changes, audits] = await Promise.all([
    db
      .collection(RESEARCH_COLLECTIONS.kgObservations)
      .find({ workspaceId })
      .sort({ observedAt: -1 })
      .limit(limit)
      .toArray(),
    db
      .collection(RESEARCH_COLLECTIONS.kgChanges)
      .find({ workspaceId })
      .sort({ detectedAt: -1 })
      .limit(limit)
      .toArray(),
    db
      .collection(RESEARCH_COLLECTIONS.monitorAudits)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray(),
  ]);

  return NextResponse.json({
    ok: true,
    observations,
    changes,
    monitorAudits: audits,
  });
}
