import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { requestSessionRefresh } from '@/lib/research/browser-gateway/gateway';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';

/** Queue worker-side session re-validation (no Playwright in Next.js). */
export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const portal = String(body.portal || '').trim();
    if (!portal) {
      return NextResponse.json({ error: 'portal is required.' }, { status: 400 });
    }

    const result = await requestSessionRefresh({
      workspaceId,
      portal,
      actorId: auth.admin.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[research] refresh_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refresh failed.' },
      { status: 500 },
    );
  }
}
