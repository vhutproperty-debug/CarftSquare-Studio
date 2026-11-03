import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getInventoryDb, listApartments, listRentals, listTowers } from '@/lib/ops/inventory/store';
import { forbidUnlessPhase, releaseList } from '@/lib/ops/os/guard';
import { redactBrokerPayload } from '@/lib/ops/os/redact';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const closed = forbidUnlessPhase(3);
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const db = await getInventoryDb();
  const [apartments, rentals, towers] = await Promise.all([
    listApartments(db),
    listRentals(db),
    listTowers(db),
  ]);
  const visibleApartments = releaseList(auth.admin, apartments, 'resale');
  const visibleRentals = releaseList(auth.admin, rentals, 'resale');
  return NextResponse.json(redactBrokerPayload({
    apartments: visibleApartments,
    rentals: visibleRentals,
    towers,
    redacted: true,
  }));
}
