import { NextResponse } from 'next/server';
import { authorizeProjectWrite, deniedProjectAuth } from '@/lib/ops/projects/api-auth';
import { projectError } from '@/lib/ops/projects/http';
import { storeProjectFile } from '@/lib/ops/projects/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await authorizeProjectWrite(request);
  if (deniedProjectAuth(auth)) return auth.response;
  if (auth.actor.via === 'token') {
    return NextResponse.json({ error: 'Upload a floor plan from an admin session, or paste an https URL in the project payload.' }, { status: 403 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image or PDF.' }, { status: 400 });
    const stored = await storeProjectFile(file);
    return NextResponse.json({ ok: true, floorPlan: { ...stored, id: stored.url } });
  } catch (error) {
    return projectError(error, 'Unable to store that file. Paste an https URL instead.');
  }
}
