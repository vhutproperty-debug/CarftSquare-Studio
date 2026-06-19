import MetaLandingClient from '@/components/meta-landing/MetaLandingClient';
import { getMetaLandingGalleryItems } from '@/lib/meta-landing/gallery-queries';
import { getDatabase, ensureReviewIndexes, listApprovedReviews, toPublicReviewCards } from '@/lib/reviews/store';

export const metadata = {
  title: 'Free AI Interior Consultation | CraftSquare Studio Mumbai',
  description:
    'Get a FREE AI-powered interior estimate and expert consultation in under 60 seconds. Mumbai interior design experts.',
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

export default async function FreeInteriorConsultationPage() {
  let reviews = [];
  let galleryItems = [];

  try {
    const db = await getDatabase();
    await ensureReviewIndexes(db);
    const [rows, gallery] = await Promise.all([
      listApprovedReviews(db, 6),
      getMetaLandingGalleryItems(12),
    ]);
    reviews = toPublicReviewCards(rows);
    galleryItems = gallery;
  } catch {
    reviews = [];
    galleryItems = [];
  }

  const heroImage = galleryItems[0]?.image || null;

  return <MetaLandingClient reviews={reviews} galleryItems={galleryItems} heroImage={heroImage} />;
}
