import { NextResponse } from 'next/server';
import {
  ensurePaintingTestimonialIndexes,
  getPaintingTestimonialsDatabase,
  listActivePaintingTestimonials,
} from '@/lib/painting/testimonials-store';

export const revalidate = 3600;

export async function GET() {
  try {
    const db = await getPaintingTestimonialsDatabase();
    await ensurePaintingTestimonialIndexes(db);
    const testimonials = await listActivePaintingTestimonials(db, 12);
    return NextResponse.json({ testimonials });
  } catch {
    return NextResponse.json({ testimonials: [] });
  }
}
