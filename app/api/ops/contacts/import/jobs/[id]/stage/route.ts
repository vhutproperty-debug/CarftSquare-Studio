import { authorizeContacts, deniedContactAuth } from '@/lib/ops/contacts/auth';
import { contactError, handleStageImport } from '@/lib/ops/contacts/handlers';
import { getContactsDb } from '@/lib/ops/contacts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContacts(request, 'view');
  if (deniedContactAuth(auth)) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const payload = body as { startIndex?: number; rows?: Array<Record<string, string>> };
    return await handleStageImport(
      await getContactsDb(),
      auth,
      params.id,
      Number(payload.startIndex || 0),
      payload.rows || [],
    );
  } catch (error) {
    return contactError(error, 'Unable to stage rows.');
  }
}
