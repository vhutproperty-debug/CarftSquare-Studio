import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess, requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import {
  listAliases,
  registerAlias,
  resolveCanonicalName,
  type KgAliasEntityType,
} from '@/lib/research/graph/aliases';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const entityType = searchParams.get('entityType') as KgAliasEntityType | null;
  const resolve = searchParams.get('resolve');

  try {
    if (resolve && entityType) {
      const canonical = await resolveCanonicalName(workspaceId, entityType, resolve);
      return NextResponse.json({ ok: true, input: resolve, canonical });
    }
    const aliases = await listAliases(workspaceId, entityType || undefined);
    return NextResponse.json({ ok: true, aliases });
  } catch (error) {
    console.error('[research] kg_aliases_failed', error);
    return NextResponse.json({ error: 'Alias lookup failed.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const entityType = body.entityType as KgAliasEntityType;
    const canonicalName = String(body.canonicalName || '').trim();
    const alias = String(body.alias || '').trim();
    if (!entityType || !canonicalName || !alias) {
      return NextResponse.json(
        { error: 'entityType, canonicalName, and alias are required.' },
        { status: 400 },
      );
    }
    const doc = await registerAlias({ workspaceId, entityType, canonicalName, alias });
    return NextResponse.json({ ok: true, alias: doc });
  } catch (error) {
    console.error('[research] kg_alias_create_failed', error);
    return NextResponse.json({ error: 'Failed to register alias.' }, { status: 500 });
  }
}
