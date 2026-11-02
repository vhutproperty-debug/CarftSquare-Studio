import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleUpsert } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await authorizeContacts(request, 'token_or_manage');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    const records = body && typeof body === 'object' && Array.isArray((body as { contacts?: unknown }).contacts)
      ? (body as { contacts: Array<Record<string, string>> }).contacts
      : null;
    if (!records) return Response.json({ error: 'Send { contacts: [...] } with at most 200 rows.' }, { status: 400 });
    return await handleUpsert(await getContactsDb(), auth, records);
  } catch (error) {
    return contactError(error, 'Unable to upsert contacts.');
  }
}
