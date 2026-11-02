import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handlePreviewUpload } from '@/lib/ops/contacts/handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a CSV or XLSX file.' }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    return await handlePreviewUpload(auth, file.name, bytes);
  } catch (error) {
    return contactError(error, 'Unable to read the file.');
  }
}
