import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { forbidUnlessOps, forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';
import { canOps } from '@/lib/ops/os/permissions';
import {
  APARTMENTS_COLLECTION,
  DEVELOPERS_COLLECTION,
  RENTALS_COLLECTION,
  TOWERS_COLLECTION,
  createDeveloper,
  createRental,
  createTower,
  getInventoryDb,
  listApartments,
  listDevelopers,
  listRentals,
  listTowers,
  saveApartment,
  softDeleteInventory,
} from '@/lib/ops/inventory/store';

export const dynamic = 'force-dynamic';

const COLLECTIONS: Record<string, string> = {
  developer: DEVELOPERS_COLLECTION,
  tower: TOWERS_COLLECTION,
  apartment: APARTMENTS_COLLECTION,
  rental: RENTALS_COLLECTION,
};

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(2);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const db = await getInventoryDb();
  const [developers, towers, apartments, rentals] = await Promise.all([
    listDevelopers(db),
    listTowers(db),
    listApartments(db),
    listRentals(db),
  ]);
  return NextResponse.json({
    developers: releaseList(auth.admin, developers, 'project'),
    towers: releaseList(auth.admin, towers, 'project'),
    apartments: releaseList(auth.admin, apartments, 'resale'),
    rentals: releaseList(auth.admin, rentals, 'resale'),
  });
}

export async function POST(request: Request) {
  const closed = forbidUnlessPhase(2);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!canOps(auth.admin, 'fill_empty') && !canOps(auth.admin, 'edit')) {
    return NextResponse.json({ error: 'You do not have permission to add inventory.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Inventory payload is required.' }, { status: 400 });
  const kind = String(body.kind || '');
  const db = await getInventoryDb();
  try {
    if (kind === 'developer') {
      const developer = await createDeveloper(db, {
        name: String(body.name || ''),
        locality: String(body.locality || ''),
        rera: String(body.rera || ''),
        assignedTo: String(body.assignedTo || ''),
      }, auth.admin.id);
      return NextResponse.json({ developer }, { status: 201 });
    }
    if (kind === 'tower') {
      const tower = await createTower(db, {
        developerId: String(body.developerId || ''),
        projectName: String(body.projectName || ''),
        name: String(body.name || ''),
        assignedTo: String(body.assignedTo || ''),
      }, auth.admin.id);
      return NextResponse.json({ tower }, { status: 201 });
    }
    if (kind === 'apartment') {
      const result = await saveApartment(db, {
        developerId: String(body.developerId || ''),
        towerId: String(body.towerId || ''),
        projectName: String(body.projectName || ''),
        towerName: String(body.towerName || ''),
        flat: String(body.flat || ''),
        candidateUnitIds: Array.isArray(body.candidateUnitIds) ? body.candidateUnitIds.map(String) : [],
        assignedTo: String(body.assignedTo || ''),
      }, auth.admin.id);
      return NextResponse.json({ ...result, merged: false }, { status: result.created ? 201 : 200 });
    }
    if (kind === 'rental') {
      const rental = await createRental(db, {
        apartmentId: String(body.apartmentId || ''),
        rent: String(body.rent || ''),
        deposit: String(body.deposit || ''),
        status: body.status === 'on_hold' || body.status === 'leased' ? body.status : 'available',
      }, auth.admin.id);
      return NextResponse.json({ rental }, { status: 201 });
    }
    return NextResponse.json({ error: 'Kind must be developer, tower, apartment, or rental.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to save inventory.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const closed = forbidUnlessPhase(2);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const blocked = forbidUnlessOps(auth.admin, 'delete');
  if (blocked) return blocked;
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') || '';
  const id = url.searchParams.get('id') || '';
  const collection = COLLECTIONS[kind];
  if (!collection || !id) return NextResponse.json({ error: 'Kind and id are required.' }, { status: 400 });
  const removed = await softDeleteInventory(await getInventoryDb(), collection, id, auth.admin.id);
  if (!removed) return NextResponse.json({ error: 'Record not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: false, softDeleted: true });
}
