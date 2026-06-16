import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import { trustCountersSchema, managerSchema, paymentSchema } from '@/lib/partner-network/schemas';
import {
  getPartnerDatabase,
  listActivityLogs,
  listManagers,
  listPayments,
  recordPayment,
  saveManager,
  updateTrustCounters,
} from '@/lib/partner-network/store';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || 'activity';
  const db = await getPartnerDatabase();

  if (section === 'managers') return NextResponse.json({ managers: await listManagers(db) });
  if (section === 'payments') return NextResponse.json({ payments: await listPayments(db) });

  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '50');
  const result = await listActivityLogs(db, { page, limit });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'create' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const db = await getPartnerDatabase();

    if (body.type === 'manager') {
      const parsed = managerSchema.safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const manager = await saveManager(db, parsed.data);
      return NextResponse.json({ ok: true, manager });
    }

    if (body.type === 'payment') {
      const parsed = paymentSchema.safeParse(body.data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const payment = await recordPayment(db, {
        ...parsed.data,
        partnerId: body.data.partnerId,
        commissionId: parsed.data.commissionId,
      }, auth.admin?.id || 'admin');
      return NextResponse.json({ ok: true, payment });
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PARTNER_NETWORK, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    if (body.type !== 'trust_counters') return NextResponse.json({ error: 'Unknown type' }, { status: 400 });

    const parsed = trustCountersSchema.safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const db = await getPartnerDatabase();
    await updateTrustCounters(db, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 400 });
  }
}
