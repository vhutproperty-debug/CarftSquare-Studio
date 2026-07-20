import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { getPortalMeta } from '@/lib/research/browser/config';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Ctx = { params: { portal: string } };

/**
 * Legacy capture endpoint — must NOT launch Playwright on Vercel.
 * Use remote Connect (Browser Worker) which captures + validates on Railway.
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

  return NextResponse.json(
    {
      ok: false,
      error:
        'Cookie capture runs only on the Railway Browser Worker. Use Connectors → Connect (remote browser), not Capture on Vercel.',
      workspaceId,
      portal,
      portalName: meta.displayName,
    },
    { status: 501 },
  );
}
