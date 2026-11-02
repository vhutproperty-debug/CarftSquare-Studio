import { NextResponse } from 'next/server';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { filterOutreach, outreachOptions, statusCounts } from '@/lib/ops/outreach/query';
import { approveWave, getOutreachDatabase, listApprovals, listOutreach, listTemplates, saveOutreach } from '@/lib/ops/outreach/store';
import { OUTREACH_AUDIENCES, OUTREACH_STATUSES, type OutreachAudience, type OutreachListQuery, type OutreachStatus } from '@/lib/ops/outreach/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function queryFrom(url: URL): OutreachListQuery {
  const audience = url.searchParams.get('audience') || '';
  const status = url.searchParams.get('status') || '';
  return {
    audience: (OUTREACH_AUDIENCES as readonly string[]).includes(audience) ? audience as OutreachAudience : '',
    wave: url.searchParams.get('wave') || '',
    project: url.searchParams.get('project') || '',
    tower: url.searchParams.get('tower') || '',
    status: (OUTREACH_STATUSES as readonly string[]).includes(status) ? status as OutreachStatus : '',
    q: url.searchParams.get('q') || '',
  };
}

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const db = await getOutreachDatabase();
    const [contacts, templates, approvals] = await Promise.all([listOutreach(db), listTemplates(db), listApprovals(db)]);
    const query = queryFrom(new URL(request.url));
    const items = filterOutreach(contacts, query);
    await logOpsActivity({
      action: 'view_outreach',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'outreach_contacts',
      details: { shown: items.length },
      request,
    });
    return NextResponse.json({
      items,
      total: items.length,
      counts: statusCounts(items),
      options: outreachOptions(contacts),
      templates,
      approvals,
      canManage: auth.canManage,
    });
  } catch (error) {
    return projectError(error, 'Unable to load outreach.');
  }
}

async function upsert(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Payload must be an object.' }, { status: 400 });
    const result = await saveOutreach(await getOutreachDatabase(), body as Record<string, unknown>, actorLabel(auth.actor));
    await logOpsActivity({
      action: 'upsert_outreach',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'outreach_contacts',
      resourceId: result.contact.id,
      details: { audience: result.contact.audience, created: result.created, via: auth.actor.via },
      request,
    });
    return NextResponse.json({ ok: true, created: result.created, contact: result.contact });
  } catch (error) {
    return projectError(error, 'Unable to save the contact.');
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'approve') {
    const auth = await authorizeProjectWrite(request);
    if (deniedProjectAuth(auth)) return auth.response;
    try {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const audience = String(body.audience || '');
      const approval = await approveWave(await getOutreachDatabase(), {
        wave: String(body.wave || ''),
        audience: (OUTREACH_AUDIENCES as readonly string[]).includes(audience) ? audience as OutreachAudience : '',
        note: String(body.note || 'Wave approved. No messages were sent.'),
      }, actorLabel(auth.actor));
      await logOpsActivity({
        action: 'approve_outreach_wave',
        actorId: auth.actor.id,
        actorEmail: auth.actor.email,
        resource: 'outreach_wave_approvals',
        resourceId: approval.id,
        details: { wave: approval.wave, audience: approval.audience },
        request,
      });
      return NextResponse.json({ ok: true, approval, sent: false });
    } catch (error) {
      return projectError(error, 'Unable to record the approval.');
    }
  }
  return upsert(request);
}

export async function PATCH(request: Request) {
  return upsert(request);
}
