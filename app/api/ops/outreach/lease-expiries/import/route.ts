import { NextResponse } from 'next/server';
import { parseLeaseCsv } from '@/lib/ops/lease-expiries/parse';
import { getLeaseDatabase, saveLeaseExpiry } from '@/lib/ops/lease-expiries/store';
import { actorLabel, authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  if (auth.actor.via === 'token') {
    return NextResponse.json({ error: 'Upload the CSV from an admin session. The bearer token upserts one lease at a time.' }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a CSV file.' }, { status: 400 });
    const rows = parseLeaseCsv(await file.text());
    const db = await getLeaseDatabase();
    let created = 0;
    let updated = 0;
    for (const row of rows) {
      const result = await saveLeaseExpiry(db, row, actorLabel(auth.actor));
      if (result.created) created += 1;
      else updated += 1;
    }
    return NextResponse.json({ ok: true, rows: rows.length, created, updated });
  } catch (error) {
    return projectError(error, 'Unable to import lease expiries.');
  }
}
