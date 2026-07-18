import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import {
  createResearchReportPdf,
  listingsToCsv,
  listingsToExcelXml,
} from '@/lib/research/ai/exports';
import { executiveResearchAgent } from '@/lib/research/ai/executive-research-agent';
import { requireResearchViewAccess } from '@/lib/research/auth';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'csv').toLowerCase();

  try {
    const session = await executiveResearchAgent.getSession(params.id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'pdf') {
      if (!session.report) {
        return NextResponse.json({ error: 'Report not ready.' }, { status: 400 });
      }
      const buf = createResearchReportPdf(session.report);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="research-report-${session.id.slice(0, 8)}-${stamp}.pdf"`,
        },
      });
    }

    if (format === 'xlsx' || format === 'excel') {
      const xml = listingsToExcelXml(session.listings, {
        sessionId: session.id,
        title: session.title,
      });
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel',
          'Content-Disposition': `attachment; filename="research-comparison-${session.id.slice(0, 8)}-${stamp}.xls"`,
        },
      });
    }

    const csv = listingsToCsv(session.listings, {
      sessionId: session.id,
      generatedAt: new Date().toISOString(),
    });
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="research-listings-${session.id.slice(0, 8)}-${stamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('[research] ai_export_failed', error);
    return NextResponse.json({ error: 'Export failed.' }, { status: 500 });
  }
}
