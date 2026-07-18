import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { getPortalMeta } from '@/lib/research/browser/config';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { researchConnectorService } from '@/services/research/connector-service';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';

export const runtime = 'nodejs';

type Ctx = { params: { portal: string } };

export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const portal = params.portal;
  const meta = getPortalMeta(portal);
  if (!meta) {
    return NextResponse.json({ error: 'Unknown portal.' }, { status: 400 });
  }

  let workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.workspaceId === 'string' && body.workspaceId.trim()) {
      workspaceId = body.workspaceId.trim();
    }
  } catch {
    /* empty body */
  }

  try {
    const connection = await researchConnectorService.connect(workspaceId, portal);
    const session = await browserSessionManager.getOrCreate(workspaceId, portal);
    return NextResponse.json({
      ok: true,
      connection,
      session,
      loginUrl: meta.loginUrl,
      message:
        'Session profile created. Log in via the headed login script, then call Capture Session.',
    });
  } catch (error) {
    console.error('[research] connect_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connect failed.' },
      { status: 500 },
    );
  }
}
