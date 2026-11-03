import { csvEscape } from '@/lib/ops/csv';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { authorizeProjectRead, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { filterOutreach } from '@/lib/ops/outreach/query';
import { getOutreachDatabase, listOutreach } from '@/lib/ops/outreach/store';
import { OUTREACH_AUDIENCES, OUTREACH_STATUSES, type OutreachAudience, type OutreachStatus } from '@/lib/ops/outreach/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  if (!auth.canExport) {
    return new Response(JSON.stringify({ error: 'Only a super admin can export.' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const url = new URL(request.url);
    const audience = url.searchParams.get('audience') || '';
    const status = url.searchParams.get('status') || '';
    const contacts = filterOutreach(await listOutreach(await getOutreachDatabase()), {
      audience: (OUTREACH_AUDIENCES as readonly string[]).includes(audience) ? audience as OutreachAudience : '',
      wave: url.searchParams.get('wave') || '',
      project: url.searchParams.get('project') || '',
      tower: url.searchParams.get('tower') || '',
      status: (OUTREACH_STATUSES as readonly string[]).includes(status) ? status as OutreachStatus : '',
      q: '',
    });
    const header = ['audience', 'wave', 'priority', 'project', 'tower', 'floor', 'bhk', 'flats', 'name', 'role', 'phone_e164', 'email', 'signal', 'lease_end', 'already_contacted', 'status', 'notes', 'message'];
    const lines = [header.join(',')];
    contacts.forEach((contact) => {
      lines.push([
        contact.audience, contact.wave, contact.priority, contact.project, contact.tower, contact.floor, contact.bhk,
        contact.flats.join(';'), contact.name, contact.role, contact.phone_e164, contact.email, contact.signal,
        contact.lease_end, contact.already_contacted ? 'yes' : 'no', contact.status, contact.notes, contact.message,
      ].map(csvEscape).join(','));
    });
    await logOpsActivity({
      action: 'export_outreach',
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      resource: 'outreach_contacts',
      details: { rows: contacts.length, wave: url.searchParams.get('wave') || '' },
      request,
    });
    return new Response(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="outreach-wave.csv"',
      },
    });
  } catch (error) {
    return projectError(error, 'Unable to export outreach.');
  }
}
