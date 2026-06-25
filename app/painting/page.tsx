import PaintingLandingClient from '@/components/painting/PaintingLandingClient';
import { FALLBACK_TESTIMONIALS } from '@/lib/painting/content';
import {
  ensurePaintingGalleryIndexes,
  getPaintingGalleryDatabase,
  listActivePaintingGalleryItems,
} from '@/lib/painting/gallery-store';
import {
  ensurePaintingTestimonialIndexes,
  getPaintingTestimonialsDatabase,
  listActivePaintingTestimonials,
} from '@/lib/painting/testimonials-store';

export const revalidate = 3600;

export default async function PaintingPage() {
  let galleryItems: Awaited<ReturnType<typeof listActivePaintingGalleryItems>> = [];
  let testimonials = FALLBACK_TESTIMONIALS;

  try {
    const [galleryDb, testimonialsDb] = await Promise.all([
      getPaintingGalleryDatabase(),
      getPaintingTestimonialsDatabase(),
    ]);
    await Promise.all([
      ensurePaintingGalleryIndexes(galleryDb),
      ensurePaintingTestimonialIndexes(testimonialsDb),
    ]);
    const [gallery, dbTestimonials] = await Promise.all([
      listActivePaintingGalleryItems(galleryDb, 24),
      listActivePaintingTestimonials(testimonialsDb, 12),
    ]);
    galleryItems = gallery;
    if (dbTestimonials.length) {
      testimonials = dbTestimonials;
    }
  } catch {
    galleryItems = [];
  }

  const heroImage = galleryItems[0]?.imageUrl || null;

  return (
    <PaintingLandingClient
      galleryItems={galleryItems}
      testimonials={testimonials}
      heroImage={heroImage}
    />
  );
}
