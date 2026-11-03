import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { WA_CONVERSATIONS_COLLECTION } from '@/lib/whatsapp-cloud/conversation-store';
import { buildInbox, withCapturedLeads } from '@/lib/ops/crm/inbox';
import { getCrmDb, listRequirements } from '@/lib/ops/crm/requirements-store';
import { listGrowthCaptures } from '@/lib/ops/growth/capture/store';
import { growthModuleEnabled } from '@/lib/ops/os/flags';
import { forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(3);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const db = await getCrmDb();
  const requirements = await listRequirements(db);
  const demands = await db.collection('ops_demand_records').find({}).limit(100).toArray();
  const conversations = await db.collection(WA_CONVERSATIONS_COLLECTION).find({}).limit(100).toArray();
  const items = buildInbox({
    requirements: requirements.map((row) => ({
      id: row.id,
      title: [row.bhk && `${row.bhk} BHK`, row.localities.join(', ')].filter(Boolean).join(' · ') || 'Requirement',
      at: row.updatedAt,
      assignedTo: row.assignedTo,
    })),
    demands: demands.map((row) => ({
      id: String(row.id || ''),
      title: String(row.qualification?.locality || row.qualification?.bhk || 'Demand enquiry'),
      at: String(row.updatedAt || row.createdAt || ''),
      assignedTo: String(row.assignedTo || ''),
    })).filter((row) => row.id),
    conversations: conversations.map((row) => ({
      id: String(row.id || ''),
      title: 'WhatsApp conversation',
      at: String(row.updatedAt || row.lastMessageAt || ''),
      assignedTo: String(row.assignedTo || ''),
    })).filter((row) => row.id),
  });
  const captured = growthModuleEnabled('LEAD_CAPTURE') ? await listGrowthCaptures(db) : [];
  const visible = withCapturedLeads(items, captured.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.source === 'meta_instant_form'
      ? `Meta Instant Form${row.campaignId ? ` · ${row.campaignId}` : ''}`
      : 'WhatsApp enquiry',
    at: row.at,
  })));
  return NextResponse.json({
    items: releaseList(auth.admin, visible, 'client'),
    merged: false,
  });
}
