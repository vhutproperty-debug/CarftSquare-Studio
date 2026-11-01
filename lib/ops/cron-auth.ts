import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';

/** Vercel Cron sends Authorization: Bearer CRON_SECRET. Ops admins may trigger the same route. */
export async function authorizeCron(request: Request): Promise<Response | null> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return null;
  const legacy = process.env.OPS_FOLLOWUPS_CRON_SECRET?.trim();
  const headerSecret = request.headers.get('x-ops-followups-secret');
  if (legacy && headerSecret && headerSecret === legacy) return null;
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  return null;
}

export function cronUnauthorized(message = 'Cron authorization required.') {
  return NextResponse.json({ error: message }, { status: 401 });
}
