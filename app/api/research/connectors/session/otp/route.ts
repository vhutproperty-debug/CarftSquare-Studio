import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchEditAccess } from '@/lib/research/auth';
import {
  getConnectSessionById,
  publicConnectSession,
  updateConnectSession,
} from '@/lib/research/browser-gateway/connect-session-store';
import { usesConnectAuthEngine } from '@/lib/research/browser-gateway/connect-auth-engine';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

export const runtime = 'nodejs';

/**
 * Submit OTP for an in-flight Connect session (auth engine portals only).
 * Stores pendingOtp for the Browser Worker to consume — never returns the OTP.
 */
export async function POST(request: Request) {
  const auth = await requireResearchEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId =
      typeof body.workspaceId === 'string' && body.workspaceId.trim()
        ? body.workspaceId.trim()
        : DEFAULT_RESEARCH_WORKSPACE.id;
    const sessionId = String(body.sessionId || body.connectSessionId || '').trim();
    const otp = String(body.otp || '').replace(/\D/g, '');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
    }
    if (otp.length < 4 || otp.length > 8) {
      return NextResponse.json({ error: 'OTP must be 4–8 digits.' }, { status: 400 });
    }

    const session = await getConnectSessionById(sessionId);
    if (!session || session.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Connect session not found.' }, { status: 404 });
    }
    if (!usesConnectAuthEngine(session.portal)) {
      return NextResponse.json(
        { error: 'OTP chat submit is not used for this portal. Enter OTP in LiveView.' },
        { status: 400 },
      );
    }
    if (session.phase !== 'waiting_for_login' && session.phase !== 'verifying') {
      return NextResponse.json(
        {
          error: `Session is ${session.phase} — OTP can only be submitted while waiting for login.`,
        },
        { status: 409 },
      );
    }

    await updateConnectSession(sessionId, {
      pendingOtp: otp,
      pendingOtpAt: new Date().toISOString(),
      message: 'OTP received — entering into secure browser…',
      authChallenge: 'otp',
    });

    const publicSession = publicConnectSession({
      ...(await getConnectSessionById(sessionId))!,
    });

    return NextResponse.json({
      ok: true,
      message: 'OTP queued for the Browser Worker. Keep LiveView open.',
      connectSession: publicSession,
    });
  } catch (error) {
    console.error('[research] connect_otp_submit_failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit OTP.' },
      { status: 500 },
    );
  }
}
