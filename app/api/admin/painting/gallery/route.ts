import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import {
  deletePaintingGalleryItem,
  ensurePaintingGalleryIndexes,
  getPaintingGalleryDatabase,
  listAllPaintingGalleryItems,
  savePaintingGalleryItem,
} from '@/lib/painting/gallery-store';
import { paintingGalleryDeleteSchema, paintingGalleryItemSchema } from '@/lib/painting/schemas';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const db = await getPaintingGalleryDatabase();
  await ensurePaintingGalleryIndexes(db);
  const items = await listAllPaintingGalleryItems(db);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = paintingGalleryItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getPaintingGalleryDatabase();
  await ensurePaintingGalleryIndexes(db);
  const item = await savePaintingGalleryItem(db, parsed.data);
  return NextResponse.json({ item }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'delete' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = paintingGalleryDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getPaintingGalleryDatabase();
  const deleted = await deletePaintingGalleryItem(db, parsed.data.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Gallery item not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
