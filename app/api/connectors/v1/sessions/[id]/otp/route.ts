import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import {
  connectorApiErrorResponse,
  resolveWorkspaceId,
} from '@/lib/research/connector-api/http';
import { submitConnectorSessionOtp } from '@/lib/research/connector-api/service';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/**
 * Connector API v1 — submit an OTP for an in-flight connect session.
 * Body: { otp, workspaceId? }. The OTP is consumed by the Browser Worker
 * and never returned in any response.
 */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = resolveWorkspaceId(body.workspaceId);
    const session = await submitConnectorSessionOtp({
      workspaceId,
      sessionId: params.id,
      otp: String(body.otp || ''),
    });
    return NextResponse.json({
      ok: true,
      session,
      message: 'OTP queued for the Browser Worker.',
    });
  } catch (error) {
    return connectorApiErrorResponse(error, 'Failed to submit OTP.');
  }
}
