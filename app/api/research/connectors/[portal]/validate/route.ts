import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { requirePortalConnector } from '@/connectors/registry';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: { portal: string } };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  let workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.workspaceId === 'string' && body.workspaceId.trim()) {
      workspaceId = body.workspaceId.trim();
    }
  } catch {
    /* empty */
  }

  try {
    const connector = requirePortalConnector(params.portal);
    const result = await connector.validateSession(workspaceId);
    return NextResponse.json({ ok: result.ok, ...result });
  } catch (error) {
    console.error('[research] validate_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed.' },
      { status: 500 },
    );
  }
}
