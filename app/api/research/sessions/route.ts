import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { browserSessionManager } from '@/lib/research/sessions/browser-session-manager';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const sessions = await browserSessionManager.list(workspaceId);
    return NextResponse.json({ ok: true, workspaceId, sessions });
  } catch (error) {
    console.error('[research] sessions_list_failed', error);
    return NextResponse.json({ error: 'Failed to list sessions.' }, { status: 500 });
  }
}
