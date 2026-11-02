import { contactError, handleCreateContact, handleListContacts } from '@/lib/ops/contacts/handlers';
import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import type { ContactPatch } from '@/lib/ops/contacts/policy';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    return await handleListContacts(await getContactsDb(), auth, new URL(request.url));
  } catch (error) {
    return contactError(error, 'Unable to load contacts.');
  }
}

export async function POST(request: Request) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    return await handleCreateContact(await getContactsDb(), auth, (body || {}) as ContactPatch);
  } catch (error) {
    return contactError(error, 'Unable to create the contact.');
  }
}
