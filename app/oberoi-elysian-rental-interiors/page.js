import OberoiElysianClient from '@/components/oberoi-elysian/OberoiElysianClient';
import { getOberoiGalleryItems } from '@/lib/oberoi-elysian/gallery-queries';

export const metadata = {
  title: 'Oberoi Elysian Rental Interiors | Pre-Possession Planning | CraftSquare Studio',
  description:
    'Plan rental interiors before possession at Oberoi Elysian, Mumbai. AI-powered budgeting, rental packages, and turnkey execution from CraftSquare Studio.',
  openGraph: {
    title: 'Oberoi Elysian Rental Interior Planning | CraftSquare Studio',
    description:
      'Plan early. Rent faster. Maximize rental income with pre-possession rental interior planning for Oberoi Elysian homeowners.',
  },
};

export const revalidate = 3600;

export default async function OberoiElysianRentalInteriorsPage() {
  let galleryItems = [];

  try {
    galleryItems = await getOberoiGalleryItems(12);
  } catch {
    galleryItems = [];
  }

  const heroImage = galleryItems[0]?.image || null;

  return <OberoiElysianClient galleryItems={galleryItems} heroImage={heroImage} />;
}
