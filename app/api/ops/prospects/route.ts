import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { getDatabase, createProspect, listProspects } from '@/lib/ops/calls/prospect-store';
import {
  createProspectSchema,
  normalizeProspectPhone,
} from '@/lib/ops/calls/schemas';
import { canViewAllCallRecords } from '@/lib/ops/calls/query';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);

  try {
    const db = await getDatabase();
    const prospects = await listProspects(db, {
      assignedTo: searchParams.get('assignedTo') || undefined,
      mineOnly: searchParams.get('mineOnly') === 'true',
      currentAdminId: auth.admin.id,
      isAdminViewAll: canViewAllCallRecords(auth.admin),
      search: searchParams.get('search') || undefined,
      limit: 500,
    });
    return NextResponse.json({ prospects });
  } catch (error) {
    console.error('[ops-prospects] list_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load prospects.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = createProspectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const db = await getDatabase();
    const prospect = await createProspect(db, {
      name: data.name?.trim() || undefined,
      phone: normalizeProspectPhone(data.phone),
      alternatePhone: data.alternatePhone ? normalizeProspectPhone(data.alternatePhone) : undefined,
      email: data.email?.trim() || undefined,
      prospectType: data.prospectType,
      projectName: data.projectName?.trim() || undefined,
      building: data.building?.trim() || undefined,
      unit: data.unit?.trim() || undefined,
      location: data.location?.trim() || undefined,
      requirement: data.requirement?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      source: data.source,
      assignedTo: data.assignedTo?.trim() || auth.admin.id,
      createdBy: auth.admin.id,
    });

    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    console.error('[ops-prospects] create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create prospect.' }, { status: 500 });
  }
}
