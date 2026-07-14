import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { getDb } from '@/lib/mongodb';

const COLLECTION = 'housing_com_leads';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!phone) {
      return NextResponse.json({ error: 'Phone is required.' }, { status: 400 });
    }

    const lead = {
      id: uuidv4(),
      name: typeof body.name === 'string' ? body.name.trim() : '',
      phone,
      email: typeof body.email === 'string' ? body.email.trim() : '',
      location: typeof body.location === 'string' ? body.location.trim() : '',
      requirement: typeof body.requirement === 'string' ? body.requirement.trim() : '',
      createdAt: new Date().toISOString(),
    };

    const db = await getDb();
    await db.collection(COLLECTION).insertOne(lead);

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    console.error('[ops-leads-housing-com] create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to create Housing.com lead.' }, { status: 500 });
  }
}
