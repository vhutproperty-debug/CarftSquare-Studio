import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { listAiSessions } from '@/lib/research/ai/session-store';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import { listPortalConnections } from '@/lib/research/store/portal-connections';
import { listResearchRuns } from '@/lib/research/store/runs';
import { listResearchQueries } from '@/lib/research/store/queries';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId') || DEFAULT_RESEARCH_WORKSPACE.id;

  try {
    const [sessions, connections, runs, queries] = await Promise.all([
      listAiSessions(workspaceId, 10),
      listPortalConnections(workspaceId),
      listResearchRuns(workspaceId, 20),
      listResearchQueries(workspaceId, 20),
    ]);

    const active = sessions.find((s) => s.status === 'running') || sessions[0] || null;
    const connectedPortals = connections.filter((c) => c.status === 'connected').length;
    const today = new Date().toISOString().slice(0, 10);
    const todaysActivity = sessions.filter((s) => s.updatedAt.startsWith(today)).length;

    return NextResponse.json({
      ok: true,
      stats: {
        researchRuns: runs.length,
        connectedPortals,
        recentSearches: queries.length,
        savedSearches: 0,
        todaysActivity,
        aiSessions: sessions.length,
      },
      activeSession: active
        ? {
            id: active.id,
            title: active.title,
            status: active.status,
            progress: active.progress,
            listingsCollected: active.progress.listingsCollected,
            duplicatesRemoved: active.progress.duplicatesRemoved,
            confidence: active.report?.researchConfidence,
            reasoningSummary: active.report?.executiveSummary?.slice(0, 240),
            reportReady: Boolean(active.report),
          }
        : null,
      recentSessions: sessions.slice(0, 5).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        progress: s.progress,
        confidence: s.report?.researchConfidence,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[research] ai_dashboard_failed', error);
    return NextResponse.json({ error: 'Dashboard load failed.' }, { status: 500 });
  }
}
