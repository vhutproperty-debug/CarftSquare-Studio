import { NextResponse } from 'next/server';
import {
  ensurePaintingGalleryIndexes,
  getPaintingGalleryDatabase,
  listActivePaintingGalleryItems,
} from '@/lib/painting/gallery-store';

export const revalidate = 3600;

export async function GET() {
  try {
    const db = await getPaintingGalleryDatabase();
    await ensurePaintingGalleryIndexes(db);
    const items = await listActivePaintingGalleryItems(db, 24);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
