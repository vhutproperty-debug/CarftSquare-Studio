import {
  BLOG_SITEMAP_CHUNK,
  getBlogSitemapChunkEntries,
  getCoreSitemapEntries,
  getPublishedBlogCount,
} from '@/lib/seo/sitemap-data';

export const revalidate = 3600;

/** Single sitemap at /sitemap.xml — avoids conflicting with optional catch-all metadata routes. */
export default async function sitemap() {
  const entries = await getCoreSitemapEntries();
  const blogCount = await getPublishedBlogCount();
  const blogChunks = blogCount > 0 ? Math.ceil(blogCount / BLOG_SITEMAP_CHUNK) : 0;

  for (let chunkId = 0; chunkId < blogChunks; chunkId += 1) {
    const chunk = await getBlogSitemapChunkEntries(chunkId);
    entries.push(...chunk);
  }

  return entries;
}
