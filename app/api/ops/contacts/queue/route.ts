import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleQueue } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    return await handleQueue(await getContactsDb(), auth, new URL(request.url));
  } catch (error) {
    return contactError(error, 'Unable to load the call queue.');
  }
}
