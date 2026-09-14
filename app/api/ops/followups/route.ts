import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import {
  enqueueFollowUpJob,
  getFollowUpDatabase,
  listFollowUpJobs,
  cancelFollowUpJob,
  rescheduleFollowUpJob,
} from '@/lib/ops/followups/store';
import { getDefaultFollowUpTemplate } from '@/lib/interakt/templates';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  try {
    const db = await getFollowUpDatabase();
    const jobs = await listFollowUpJobs(db, {
      status: (searchParams.get('status') as 'queued' | 'failed' | undefined) || undefined,
      limit: Number(searchParams.get('limit') || 100),
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('[ops-followups] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to list follow-up jobs.' }, { status: 500 });
  }
}

const createSchema = z.object({
  targetType: z.enum(['ops_prospect', 'ops_supply_record', 'ops_lead', 'interakt_conversation']),
  targetId: z.string().trim().min(1).max(120),
  targetSource: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(10).max(20),
  conversationId: z.string().trim().max(120).optional(),
  templateName: z.string().trim().min(1).max(120).optional(),
  languageCode: z.string().trim().min(2).max(10).optional(),
  bodyValues: z.array(z.string().max(1000)).max(20).optional(),
  scheduledFor: z.string().min(1),
  idempotencyKey: z.string().trim().min(3).max(200),
});

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const template = parsed.data.templateName || getDefaultFollowUpTemplate().name;
    const db = await getFollowUpDatabase();
    const result = await enqueueFollowUpJob(db, {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      targetSource: parsed.data.targetSource,
      phone: parsed.data.phone,
      conversationId: parsed.data.conversationId,
      templateName: template,
      languageCode: parsed.data.languageCode,
      bodyValues: parsed.data.bodyValues,
      scheduledFor: parsed.data.scheduledFor,
      idempotencyKey: parsed.data.idempotencyKey,
      createdBy: auth.admin.id,
    });

    await logOpsActivity({
      action: 'schedule_whatsapp_followup',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_follow_up_jobs',
      resourceId: result.job.id,
      details: {
        created: result.created,
        templateName: template,
        scheduledFor: parsed.data.scheduledFor,
      },
      request,
    });

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    console.error('[ops-followups] create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to schedule follow-up.' },
      { status },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);

  try {
    const body = await request.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = await getFollowUpDatabase();
    if (body.action === 'cancel') {
      const job = await cancelFollowUpJob(db, id);
      return NextResponse.json({ job });
    }
    if (body.action === 'reschedule' && body.scheduledFor) {
      const job = await rescheduleFollowUpJob(db, id, String(body.scheduledFor));
      return NextResponse.json({ job });
    }
    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('[ops-followups] patch_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to update follow-up.' }, { status: 500 });
  }
}
