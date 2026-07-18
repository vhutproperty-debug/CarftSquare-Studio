import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { startRemoteConnect } from '@/lib/research/browser-gateway/gateway';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';

/**
 * Start SaaS-style remote browser connect.
 * Does NOT launch Playwright — enqueues work for the browser worker.
 */
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

    const result = await startRemoteConnect({
      workspaceId,
      portal,
      createdBy: auth.admin.id,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message:
        'Remote browser session queued. Keep this page open — login in the live view when it appears.',
    });
  } catch (error) {
    console.error('[research] remote_connect_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connect failed.' },
      { status: 500 },
    );
  }
}
