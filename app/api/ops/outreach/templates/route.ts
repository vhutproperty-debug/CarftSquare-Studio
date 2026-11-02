import { NextResponse } from 'next/server';
import { actorLabel, authorizeProjectRead, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { getOutreachDatabase, listTemplates, saveTemplate } from '@/lib/ops/outreach/store';
import { OUTREACH_AUDIENCES, type OutreachAudience } from '@/lib/ops/outreach/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeProjectRead(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    return NextResponse.json({ templates: await listTemplates(await getOutreachDatabase()) });
  } catch (error) {
    return projectError(error, 'Unable to load templates.');
  }
}

export async function PUT(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null) as { audience?: string; body?: string } | null;
    const audience = String(body?.audience || '');
    if (!(OUTREACH_AUDIENCES as readonly string[]).includes(audience)) {
      return NextResponse.json({ error: 'Unknown audience.' }, { status: 400 });
    }
    const template = await saveTemplate(await getOutreachDatabase(), audience as OutreachAudience, String(body?.body || ''), actorLabel(auth.actor));
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return projectError(error, 'Unable to save the template.');
  }
}
