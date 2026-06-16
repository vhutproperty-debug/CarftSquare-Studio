import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import { partnerStatusUpdateSchema } from '@/lib/partner-network/schemas';
import { getPartnerDatabase, listPartners, updatePartner } from '@/lib/partner-network/store';
import { notifyPartnerApproved, notifyPartnerRejected } from '@/lib/partner-network/notifications';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const db = await getPartnerDatabase();
  const result = await listPartners(db, {
    status: searchParams.get('status') || undefined,
    q: searchParams.get('q') || undefined,
    page: Number(searchParams.get('page') || '1'),
    limit: Number(searchParams.get('limit') || '20'),
  });
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'Partner id required' }, { status: 400 });

    const parsed = partnerStatusUpdateSchema.partial().safeParse(updates);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const db = await getPartnerDatabase();

    if (process.env.NODE_ENV === 'development') {
      console.log('[partner-network] PATCH partners', {
        id,
        updates: parsed.data,
        actorId: auth.admin?.id || 'admin',
      });
    }

    const partner = await updatePartner(db, id, parsed.data, auth.admin?.id || 'admin');
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found after update' }, { status: 404 });
    }

    if (parsed.data.status && partner.status !== parsed.data.status) {
      return NextResponse.json(
        { error: `Partner status mismatch after update (expected ${parsed.data.status}, got ${partner.status}).` },
        { status: 500 },
      );
    }

    if (parsed.data.status === 'approved') {
      notifyPartnerApproved(partner).catch((error) => {
        console.error('[partner-network] notifyPartnerApproved failed', error instanceof Error ? error.message : error);
      });
    }

    if (parsed.data.status === 'rejected') {
      notifyPartnerRejected(partner).catch((error) => {
        console.error('[partner-network] notifyPartnerRejected failed', error instanceof Error ? error.message : error);
      });
    }

    return NextResponse.json({ ok: true, partner });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed';
    if (process.env.NODE_ENV === 'development') {
      console.error('[partner-network] PATCH partners failed', message);
    }
    const status = message === 'Partner not found.' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
