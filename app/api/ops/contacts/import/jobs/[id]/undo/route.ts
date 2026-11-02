import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleUndoImport } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    return await handleUndoImport(await getContactsDb(), auth, params.id);
  } catch (error) {
    return contactError(error, 'Unable to undo the import.');
  }
}
