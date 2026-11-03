import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { isSuperAdmin } from '@/lib/auth/rbac/roles';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { explainCaptures, getIntelligenceDb, queueLeadDuplicate, saveScoreWeights } from '@/lib/ops/growth/intelligence/store';
import type { ScoreWeights } from '@/lib/ops/growth/intelligence/scores';
import { forbidBrokerGrowth, forbidUnlessGrowth } from '@/lib/ops/os/guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessGrowth('LEAD_INTELLIGENCE');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const report = await explainCaptures(await getIntelligenceDb());
  return NextResponse.json({ ...report, canEditWeights: isSuperAdmin(auth.admin), merged: false });
}

export async function POST(request: Request) {
  const closed = forbidUnlessGrowth('LEAD_INTELLIGENCE');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const body = await request.json().catch(() => null) as { action?: string; phone?: string; leadId?: string; weights?: ScoreWeights } | null;
  if (!body) return NextResponse.json({ error: 'Intelligence payload is required.' }, { status: 400 });
  const db = await getIntelligenceDb();
  if (body.action === 'weights') {
    if (!isSuperAdmin(auth.admin)) {
      return NextResponse.json({ error: 'Only a super admin can change score weights.' }, { status: 403 });
    }
    const weights = await saveScoreWeights(db, body.weights || {}, { id: auth.admin.id, email: auth.admin.email });
    return NextResponse.json({ weights });
  }
  if (body.action === 'duplicate') {
    const result = await queueLeadDuplicate(db, {
      phone: String(body.phone || ''),
      leadId: String(body.leadId || ''),
      actorId: auth.admin.id,
    });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: 'Unknown intelligence action.' }, { status: 400 });
}
