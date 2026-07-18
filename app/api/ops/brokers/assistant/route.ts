import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { runBrokerAssistantTurn } from '@/lib/ops/brokers/assistant/assistant-service';
import type { AssistantSearchState } from '@/lib/ops/brokers/assistant/types';

export const runtime = 'nodejs';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  previousState: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await runBrokerAssistantTurn({
      message: parsed.data.message,
      previousState: parsed.data.previousState as AssistantSearchState | undefined,
    });

    await logOpsActivity({
      action: 'view_broker_inventory_workspace',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_assistant',
      details: {
        total: result.total,
        interpretedAs: result.interpretedAs,
        responseMode: result.responseMode,
      },
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-brokers] assistant_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to run inventory assistant search.' }, { status: 500 });
  }
}
