import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import { leadStatusUpdateSchema } from '@/lib/partner-network/schemas';
import { getPartnerDatabase, listPartnerLeads, updatePartnerLead } from '@/lib/partner-network/store';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const db = await getPartnerDatabase();
  const result = await listPartnerLeads(db, {
    status: searchParams.get('status') || undefined,
    partnerId: searchParams.get('partnerId') || undefined,
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
    if (!id) return NextResponse.json({ error: 'Lead id required' }, { status: 400 });

    const parsed = leadStatusUpdateSchema.partial().safeParse(updates);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const db = await getPartnerDatabase();
    const lead = await updatePartnerLead(db, id, parsed.data, 'admin', auth.admin?.id || 'admin');
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found after update' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed';
    const status = message === 'Lead not found.' ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
