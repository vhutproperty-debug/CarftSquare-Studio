import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import { humanizeConnectorError } from '@/lib/research/browser-gateway/connector-status';
import { requestWorkerValidateSession } from '@/lib/research/browser-gateway/worker-client';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Ctx = { params: { portal: string } };

/**
 * Validate portal session via the Railway Browser Worker.
 * Never launches Playwright on Vercel (no Chromium there).
 */
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
    const result = await requestWorkerValidateSession({
      workspaceId,
      portal: params.portal,
    });
    const message =
      humanizeConnectorError(result.message || result.error) || result.message || undefined;
    if (result.error && !result.message && !result.ok) {
      return NextResponse.json(
        { error: humanizeConnectorError(result.error) || 'Validation failed.' },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: result.ok,
      ...result,
      message,
      error: result.error ? humanizeConnectorError(result.error) || undefined : undefined,
    });
  } catch (error) {
    console.error('[research] validate_failed', error);
    return NextResponse.json(
      {
        error:
          humanizeConnectorError(
            error instanceof Error ? error.message : 'Validation failed.',
          ) || 'Validation failed.',
      },
      { status: 500 },
    );
  }
}
