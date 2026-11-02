import { NextResponse } from 'next/server';
import { authorizeProjectWrite, deniedProjectAuth, actorLabel } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { parseOutreachCsv } from '@/lib/ops/outreach/parse';
import { getOutreachDatabase, saveOutreach } from '@/lib/ops/outreach/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  if (auth.actor.via === 'token') {
    return NextResponse.json({ error: 'Upload the CSV from an admin session. The bearer token upserts one contact at a time.' }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a CSV file.' }, { status: 400 });
    const rows = parseOutreachCsv(await file.text());
    const db = await getOutreachDatabase();
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const result = await saveOutreach(db, {
        ...row,
        phone_e164: row.phone,
        flats: (row.flats || '').split(/[;|]/).map((item) => item.trim()).filter(Boolean),
        already_contacted: ['1', 'yes', 'true'].includes((row.already_contacted || '').toLowerCase()),
      }, actorLabel(auth.actor));
      if (result.created) created += 1;
      else updated += 1;
    }
    return NextResponse.json({ ok: true, rows: rows.length, created, updated });
  } catch (error) {
    return projectError(error, 'Unable to import outreach contacts.');
  }
}
