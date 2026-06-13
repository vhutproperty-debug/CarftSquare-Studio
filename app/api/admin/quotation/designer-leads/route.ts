import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { PERMISSIONS } from '@/lib/auth/rbac/permissions';
import { designerLeadUpdateSchema } from '@/lib/designer-leads/schemas';
import {
  designerLeadsToCsv,
  ensureDesignerLeadIndexes,
  getDatabase,
  getDesignerLeadById,
  listDesignerLeads,
} from '@/lib/designer-leads/store';
import type { DesignerLeadStatus } from '@/lib/designer-leads/types';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: PERMISSIONS.CUSTOMERS });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const status = (searchParams.get('status') || '') as DesignerLeadStatus | '';
  const projectType = searchParams.get('projectType') || '';
  const exportCsv = searchParams.get('export') === 'csv';

  const db = await getDatabase();
  await ensureDesignerLeadIndexes(db);

  const leads = await listDesignerLeads(db, {
    q,
    status: status || undefined,
    projectType: projectType || undefined,
  });

  if (exportCsv) {
    const csv = designerLeadsToCsv(leads);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="human-designer-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ leads });
}

export async function PUT(request: Request) {
  const auth = await authorizeRequest(request, { permission: PERMISSIONS.CUSTOMERS });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = designerLeadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, status, notes } = parsed.data;
  const db = await getDatabase();
  const existing = await getDesignerLeadById(db, id);
  if (!existing) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const patch: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (status) patch.status = status;
  if (typeof notes === 'string') patch.notes = notes;

  await db.collection('designer_callback_leads').updateOne({ id }, { $set: patch });
  const updated = await getDesignerLeadById(db, id);

  return NextResponse.json({ message: 'Lead updated.', lead: updated });
}
