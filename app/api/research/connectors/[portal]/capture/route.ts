import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { getPortalMeta } from '@/lib/research/browser/config';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';
import { upsertPortalConnection } from '@/lib/research/store/portal-connections';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: { portal: string } };

/**
 * Capture cookies/storage from the persistent browser profile after human login.
 * Connected is ONLY set when validateSession() succeeds afterward.
 */
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
    /* empty */
  }

  try {
    const session = await browserSessionManager.getOrCreate(workspaceId, portal);
    const updated = await browserSessionManager.saveAuthenticatedState({
      workspaceId,
      portal,
    });
    const validation = await browserSessionManager.validateSession(updated.id, { force: true });
    if (!validation.ok) {
      await upsertPortalConnection({
        workspaceId,
        portalKey: portal,
        portalName: meta.displayName,
        status: 'pending',
        lastError: validation.message || 'Validation failed after capture',
      });
      return NextResponse.json(
        {
          ok: false,
          error: validation.message || 'Captured cookies failed validation — not Connected.',
          session: updated,
          previousSessionId: session.id,
        },
        { status: 400 },
      );
    }
    await upsertPortalConnection({
      workspaceId,
      portalKey: portal,
      portalName: meta.displayName,
      status: 'connected',
      lastError: null,
    });
    return NextResponse.json({
      ok: true,
      session: updated,
      previousSessionId: session.id,
      message: 'Encrypted cookies captured and validated — Connected.',
    });
  } catch (error) {
    console.error('[research] capture_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Capture failed.' },
      { status: 500 },
    );
  }
}
