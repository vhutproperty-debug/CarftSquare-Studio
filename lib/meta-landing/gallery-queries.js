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

/**
 * Loads active gallery images from the same CMS source as /api/gallery.
 * Prefers featured items, then fills from the full image set.
 */
export async function getMetaLandingGalleryItems(limit = 12) {
  try {
    const db = await getDb();
    const featuredRequest = new Request('http://internal/api/gallery?mediaType=image&featured=true');
    const allRequest = new Request('http://internal/api/gallery?mediaType=image');

    const [{ items: featuredItems }, { items: allItems }] = await Promise.all([
      getPublicGallery(db, featuredRequest),
      getPublicGallery(db, allRequest),
    ]);

    const seen = new Set();
    const merged = [];

    for (const item of [...(featuredItems || []), ...(allItems || [])]) {
      if (seen.has(item.id)) continue;
      const mapped = mapGalleryItem(item);
      if (!mapped) continue;
      seen.add(item.id);
      merged.push(mapped);
      if (merged.length >= limit) break;
    }

    return merged;
  } catch {
    return [];
  }
}
