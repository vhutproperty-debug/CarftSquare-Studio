import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import { createLeadForm, listLeadForms } from '@/lib/meta-ads/leadforms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  try {
    const forms = await listLeadForms();
    return NextResponse.json({ forms: forms.data || [] });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to list lead forms.',
    }, { status: 502 });
  }
}

const schema = z.object({ name: z.string().trim().min(3).max(80) });

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const form = await createLeadForm({ name: parsed.data.name });
    return NextResponse.json({ ok: true, form });
  } catch (error) {
    const status = (error as { status?: number }).status || 502;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to create lead form.',
    }, { status });
  }
}
