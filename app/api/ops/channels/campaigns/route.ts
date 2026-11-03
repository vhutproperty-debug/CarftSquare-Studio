import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { ChannelSafetyError, planPausedCampaign } from '@/lib/ops/channels/safety';
import { metaAutomationEnabled, phaseEnabled } from '@/lib/ops/os/flags';
import { forbidUnlessOps, forbidUnlessPhase } from '@/lib/ops/os/guard';
import { stampCreate } from '@/lib/ops/os/records';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const COLLECTION = 'ops_paused_campaigns';

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(6);
  if (closed) return closed;
  if (!metaAutomationEnabled() || !phaseEnabled(6)) {
    return NextResponse.json({ error: 'Meta automation is off. Set CSOS_META_AUTOMATION=1 to create paused drafts only.' }, { status: 403 });
  }
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'edit');
  if (blocked) return blocked;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const plan = planPausedCampaign({
      name: String(body?.name || ''),
      status: body?.status ? String(body.status) : 'PAUSED',
      changeBudget: body?.changeBudget === true || body?.dailyBudgetInr != null,
      dailyBudgetInr: body?.dailyBudgetInr != null ? Number(body.dailyBudgetInr) : undefined,
    });
    const doc = {
      id: uuidv4(),
      ...plan,
      published: false,
      ...stampCreate({ id: auth.admin.id }),
    };
    const db = await getDb();
    await db.collection(COLLECTION).insertOne({ ...doc });
    return NextResponse.json({ campaign: doc }, { status: 201 });
  } catch (error) {
    const status = error instanceof ChannelSafetyError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to plan the campaign.' }, { status });
  }
}
