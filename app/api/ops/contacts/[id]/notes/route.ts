import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleNote } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    return await handleNote(await getContactsDb(), auth, params.id, String((body as { note?: string }).note || ''));
  } catch (error) {
    return contactError(error, 'Unable to save the note.');
  }
}
