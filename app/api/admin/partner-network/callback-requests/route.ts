import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import {
  ensureCallbackRequestIndexes,
  listCallbackRequests,
  updateCallbackRequestStatus,
} from '@/lib/partner-callback/store';
import type { PartnerCallbackStatus } from '@/lib/partner-callback/types';
import { getPartnerDatabase } from '@/lib/partner-network/store';

const statusUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['pending', 'contacted', 'closed']),
});

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const db = await getPartnerDatabase();
  await ensureCallbackRequestIndexes(db);

  const requests = await listCallbackRequests(db, {
    q: searchParams.get('q') || undefined,
    status: (searchParams.get('status') as PartnerCallbackStatus) || undefined,
  });

  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid status update' }, { status: 400 });
    }

    const db = await getPartnerDatabase();
    const updated = await updateCallbackRequestStatus(db, parsed.data.id, parsed.data.status);
    if (!updated) {
      return NextResponse.json({ error: 'Callback request not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 },
    );
  }
}
