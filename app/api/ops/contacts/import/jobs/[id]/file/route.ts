import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import type { CanonicalField } from '@/lib/ops/contacts/columns';
import { contactError, handleStageUpload } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a CSV or XLSX file.' }, { status: 400 });
    const mappingRaw = form.get('mapping');
    const extraRaw = form.get('extraPhones');
    const mapping = typeof mappingRaw === 'string' ? JSON.parse(mappingRaw) as Partial<Record<CanonicalField, string>> : {};
    const extraPhones = typeof extraRaw === 'string' ? JSON.parse(extraRaw) as string[] : [];
    const bytes = Buffer.from(await file.arrayBuffer());
    return await handleStageUpload(await getContactsDb(), auth, params.id, file.name, bytes, mapping, extraPhones);
  } catch (error) {
    return contactError(error, 'Unable to stage the file.');
  }
}
