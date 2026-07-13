import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { generateMatchesSchema } from '@/lib/ops/matching/schemas';
import { generateMatches } from '@/lib/ops/matching/query';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const parsed = generateMatchesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateMatches(parsed.data, auth.admin);

    await logOpsActivity({
      action: 'generate_matches',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_matching_engine',
      details: result,
      request,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ops-matching] generate_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to generate matches.' }, { status: 500 });
  }
}
