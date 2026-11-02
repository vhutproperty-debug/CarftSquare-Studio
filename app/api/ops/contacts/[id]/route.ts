import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleDeleteContact, handleGetContact, handlePatchContact } from '@/lib/ops/contacts/handlers';
import type { ContactPatch } from '@/lib/ops/contacts/policy';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Context = { params: { id: string } };

export async function GET(request: Request, { params }: Context) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    return await handleGetContact(await getContactsDb(), auth, params.id);
  } catch (error) {
    return contactError(error, 'Unable to load the contact.');
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    return await handlePatchContact(await getContactsDb(), auth, params.id, (body || {}) as ContactPatch);
  } catch (error) {
    return contactError(error, 'Unable to update the contact.');
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    return await handleDeleteContact(await getContactsDb(), auth, params.id);
  } catch (error) {
    return contactError(error, 'Unable to delete the contact.');
  }
}
