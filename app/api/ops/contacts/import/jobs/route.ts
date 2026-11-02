import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleCreateImportJob } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    return await handleCreateImportJob(await getContactsDb(), auth, String((body as { filename?: string }).filename || ''));
  } catch (error) {
    return contactError(error, 'Unable to start the import.');
  }
}
