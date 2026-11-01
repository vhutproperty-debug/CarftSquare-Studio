import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { setConversationManualLink } from '@/lib/whatsapp-cloud/conversation-store';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';
import type { WaLinkCandidate } from '@/lib/whatsapp-cloud/types';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  entityType: z.enum(['ops_prospect', 'ops_supply_record', 'ops_lead', 'ops_demand_record']),
  entityId: z.string().trim().min(1).max(120),
  source: z.string().trim().max(80).optional(),
  sourceCollection: z.string().trim().max(80).optional(),
  matchField: z.enum([
    'phone',
    'alternatePhone',
    'normalizedOwnerMobile',
    'lead.phone',
    'lead.mobile',
    'demand.normalizedPhone',
  ]),
  label: z.string().trim().max(200).optional(),
  personKey: z.string().trim().min(1).max(200),
});

export async function POST(request: Request, { params }: Params) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const link: WaLinkCandidate = {
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      source: parsed.data.source as WaLinkCandidate['source'],
      sourceCollection: parsed.data.sourceCollection,
      matchField: parsed.data.matchField,
      confidence: 'exact',
      label: parsed.data.label,
      personKey: parsed.data.personKey,
    };

    const db = await getWaDatabase();
    const conversation = await setConversationManualLink(db, id, link);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    await logOpsActivity({
      action: 'link_whatsapp_conversation',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'wa_conversations',
      resourceId: id,
      details: {
        entityType: link.entityType,
        entityId: link.entityId,
        source: link.source || null,
      },
      request,
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('[ops-whatsapp] link_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to link conversation.' }, { status: 500 });
  }
}
