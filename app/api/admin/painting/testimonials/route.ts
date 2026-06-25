import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';
import {
  deletePaintingTestimonial,
  ensurePaintingTestimonialIndexes,
  getPaintingTestimonialsDatabase,
  listAllPaintingTestimonials,
  savePaintingTestimonial,
} from '@/lib/painting/testimonials-store';
import { paintingTestimonialDeleteSchema, paintingTestimonialSchema } from '@/lib/painting/schemas';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const db = await getPaintingTestimonialsDatabase();
  await ensurePaintingTestimonialIndexes(db);
  const testimonials = await listAllPaintingTestimonials(db);
  return NextResponse.json({ testimonials });
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = paintingTestimonialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getPaintingTestimonialsDatabase();
  await ensurePaintingTestimonialIndexes(db);
  const testimonial = await savePaintingTestimonial(db, parsed.data);
  return NextResponse.json({ testimonial }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.PAINTING, action: 'delete' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = paintingTestimonialDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getPaintingTestimonialsDatabase();
  const deleted = await deletePaintingTestimonial(db, parsed.data.id);
  if (!deleted) {
    return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
