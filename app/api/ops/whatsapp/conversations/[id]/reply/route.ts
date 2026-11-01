import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { logOpsActivity } from '@/lib/ops/activity/store';
import {
  sendMediaToConversation,
  sendSessionTextToConversation,
  sendTemplateToConversation,
} from '@/lib/whatsapp-cloud/outbound';
import { getWaDatabase } from '@/lib/whatsapp-cloud/webhook-store';

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  text: z.string().trim().min(1).max(4000).optional(),
  templateName: z.string().trim().min(1).max(120).optional(),
  languageCode: z.string().trim().min(2).max(10).optional(),
  bodyValues: z.array(z.string().max(1000)).max(20).optional(),
  headerValues: z.array(z.string().max(1000)).max(5).optional(),
  media: z.object({
    type: z.enum(['image', 'document', 'video', 'audio']),
    id: z.string().trim().min(1).optional(),
    link: z.string().trim().url().optional(),
    caption: z.string().max(1000).optional(),
    filename: z.string().max(200).optional(),
  }).optional(),
}).refine((value) => Boolean(value.text || value.templateName || value.media), {
  message: 'Provide text, a template, or media.',
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

    const db = await getWaDatabase();
    let result: { message: unknown; providerMessageId: string };
    if (parsed.data.media) {
      result = await sendMediaToConversation(db, {
        conversationId: id,
        type: parsed.data.media.type,
        id: parsed.data.media.id,
        link: parsed.data.media.link,
        caption: parsed.data.media.caption,
        filename: parsed.data.media.filename,
      });
    } else if (parsed.data.text && !parsed.data.templateName) {
      result = await sendSessionTextToConversation(db, { conversationId: id, body: parsed.data.text });
    } else {
      result = await sendTemplateToConversation(db, {
        conversationId: id,
        templateName: parsed.data.templateName || '',
        languageCode: parsed.data.languageCode,
        bodyValues: parsed.data.bodyValues,
        headerValues: parsed.data.headerValues,
      });
    }

    await logOpsActivity({
      action: 'send_whatsapp_template',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'wa_conversations',
      resourceId: id,
      details: { providerMessageId: result.providerMessageId },
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
      { error: error instanceof Error ? error.message : 'Unable to send message.' },
      { status },
    );
  }
}
