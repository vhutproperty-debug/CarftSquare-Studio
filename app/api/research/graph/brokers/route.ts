import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { findBrokerByName } from '@/lib/research/graph/query';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type { KgBroker } from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const name = searchParams.get('name')?.trim();

  try {
    if (name) {
      const broker = await findBrokerByName(workspaceId, name);
      return NextResponse.json({ ok: true, broker });
    }
    const db = await getResearchDatabase();
    await ensureResearchIndexes(db);
    await ensureKnowledgeGraphIndexes(db);
    const brokers = await db
      .collection<KgBroker>(RESEARCH_COLLECTIONS.kgBrokers)
      .find({ workspaceId })
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .toArray();
    return NextResponse.json({ ok: true, brokers });
  } catch (error) {
    console.error('[research] kg_brokers_failed', error);
    return NextResponse.json({ error: 'Broker lookup failed.' }, { status: 500 });
  }
}
