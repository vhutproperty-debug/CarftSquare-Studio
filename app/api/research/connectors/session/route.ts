import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import {
  getConnectSessionPublic,
  listConnectorStatuses,
} from '@/lib/research/browser-gateway/gateway';
import { listConnectSessions, publicConnectSession } from '@/lib/research/browser-gateway/connect-session-store';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { findBrowserSession } from '@/lib/research/sessions/session-store';

export const runtime = 'nodejs';

/**
 * Session details for drawer / live connect progress.
 * Never returns cookies or tokens.
 */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;
  const id = searchParams.get('id');
  const portal = searchParams.get('portal');

  try {
    if (id) {
      const connectSession = await getConnectSessionPublic(id);
      if (!connectSession || connectSession.workspaceId !== workspaceId) {
        return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
      }
      const browser = connectSession.browserSessionId
        ? await findBrowserSession(workspaceId, connectSession.portal)
        : await findBrowserSession(workspaceId, connectSession.portal);

      return NextResponse.json({
        ok: true,
        connectSession,
        session: browser
          ? {
              id: browser.id,
              portal: browser.portal,
              status: browser.sessionStatus,
              createdAt: browser.createdAt,
              lastUsed: browser.lastUsed,
              lastValidated: browser.lastVerified,
              expiresAt: browser.expiresAt,
              // never encryptedCookies / encryptedStorage
            }
          : null,
      });
    }

    if (portal) {
      const sessions = await listConnectSessions(workspaceId, { portal });
      const browser = await findBrowserSession(workspaceId, portal);
      return NextResponse.json({
        ok: true,
        connectSessions: sessions.map(publicConnectSession),
        session: browser
          ? {
              id: browser.id,
              portal: browser.portal,
              status: browser.sessionStatus,
              createdAt: browser.createdAt,
              lastUsed: browser.lastUsed,
              lastValidated: browser.lastVerified,
              expiresAt: browser.expiresAt,
            }
          : null,
      });
    }

    const status = await listConnectorStatuses(workspaceId);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    console.error('[research] session_get_failed', error);
    return NextResponse.json({ error: 'Failed to load session.' }, { status: 500 });
  }
}
