import { getDb } from '@/lib/mongodb';
import { getPublicGallery } from '@/lib/cms/handlers';

function mapGalleryItem(item) {
  const image = String(item.thumbnailUrl || item.imageUrl || '').trim();
  if (!image) return null;
  return {
    id: item.id,
    title: item.title,
    image,
    category: item.category || '',
  };
}

function rentalPriorityScore(item) {
  const haystack = `${item.title} ${item.category} ${item.categoryId || ''}`.toLowerCase();
  if (haystack.includes('rental')) return 100;
  if (haystack.includes('living') || haystack.includes('bedroom')) return 80;
  if (haystack.includes('wardrobe')) return 75;
  if (haystack.includes('kitchen') || haystack.includes('modular')) return 70;
  if (haystack.includes('dining')) return 65;
  if (haystack.includes('residential')) return 50;
  return 10;
}

/**
 * Loads gallery images from CMS, prioritising rental-ready project categories.
 */
export async function getOberoiGalleryItems(limit = 12) {
  try {
    const db = await getDb();
    const rentalRequest = new Request('http://internal/api/gallery?mediaType=image&category=rental-interiors');
    const allRequest = new Request('http://internal/api/gallery?mediaType=image');

    const [{ items: rentalItems }, { items: allItems }] = await Promise.all([
      getPublicGallery(db, rentalRequest),
      getPublicGallery(db, allRequest),
    ]);

    const seen = new Set();
    const merged = [];

    for (const item of [...(rentalItems || []), ...(allItems || [])]) {
      if (seen.has(item.id)) continue;
      const mapped = mapGalleryItem(item);
      if (!mapped) continue;
      seen.add(item.id);
      merged.push(mapped);
    }

    merged.sort((a, b) => rentalPriorityScore(b) - rentalPriorityScore(a));
    return merged.slice(0, limit);
  } catch {
    return [];
  }
}
