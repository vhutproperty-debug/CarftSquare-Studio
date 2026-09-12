import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { sendTemplateToConversation } from '@/lib/interakt/outbound';
import { getInteraktDatabase } from '@/lib/interakt/webhook-store';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  templateName: z.string().trim().min(1).max(120),
  languageCode: z.string().trim().min(2).max(10).optional(),
  bodyValues: z.array(z.string().max(1000)).max(20).optional(),
  headerValues: z.array(z.string().max(1000)).max(5).optional(),
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

    const db = await getInteraktDatabase();
    const result = await sendTemplateToConversation(db, {
      conversationId: id,
      templateName: parsed.data.templateName,
      languageCode: parsed.data.languageCode,
      bodyValues: parsed.data.bodyValues,
      headerValues: parsed.data.headerValues,
    });

    await logOpsActivity({
      action: 'send_whatsapp_template',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'interakt_conversations',
      resourceId: id,
      details: {
        templateName: parsed.data.templateName,
        providerMessageId: result.providerMessageId,
      },
      request,
    });

    return NextResponse.json({
      ok: true,
      message: result.message,
      providerMessageId: result.providerMessageId,
    });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    console.error('[ops-whatsapp] reply_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to send template.' },
      { status },
    );
  }
}
