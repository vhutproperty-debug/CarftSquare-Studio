import {
  getBlogSitemapChunkEntries,
  getCoreSitemapEntries,
  getSitemapChunkCount,
} from '@/lib/seo/sitemap-data';

export const revalidate = 3600;

export async function generateSitemaps() {
  const total = await getSitemapChunkCount();
  return Array.from({ length: total }, (_, id) => ({ id }));
}

export default async function sitemap({ id = 0 }) {
  const chunkId = Number(id);

  if (chunkId === 0) {
    return getCoreSitemapEntries();
  }

  return getBlogSitemapChunkEntries(chunkId - 1);
}
