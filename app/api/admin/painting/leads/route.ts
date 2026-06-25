import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import {
  paintingLeadDeleteSchema,
  paintingLeadUpdateSchema,
} from '@/lib/painting/schemas';
import {
  deletePaintingLead,
  ensurePaintingLeadIndexes,
  getPaintingDatabase,
  getPaintingLeadById,
  listPaintingLeads,
  paintingLeadsToCsv,
  updatePaintingLead,
} from '@/lib/painting/store';
import type { PaintingLeadStatus } from '@/lib/painting/types';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const status = (searchParams.get('status') || '') as PaintingLeadStatus | '';
  const exportCsv = searchParams.get('export') === 'csv';

  const db = await getPaintingDatabase();
  await ensurePaintingLeadIndexes(db);

  const leads = await listPaintingLeads(db, {
    q,
    status: status || undefined,
  });

  if (exportCsv) {
    const csv = paintingLeadsToCsv(leads);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="painting-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ leads });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = paintingLeadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getPaintingDatabase();
  const updated = await updatePaintingLead(db, parsed.data.id, {
    status: parsed.data.status,
    notes: parsed.data.notes,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, lead: updated });
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'delete' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = paintingLeadDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getPaintingDatabase();
  const existing = await getPaintingLeadById(db, parsed.data.id);
  if (!existing) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  await deletePaintingLead(db, parsed.data.id);
  return NextResponse.json({ ok: true });
}
