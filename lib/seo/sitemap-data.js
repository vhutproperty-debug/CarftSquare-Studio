import { DEFAULT_SERVICES } from '@/lib/cms/defaults';
import { absoluteUrl } from '@/lib/site';
import { loadServiceSlugs } from '@/lib/seo/load';
import { getDatabase, listPublishedSlugs } from '@/lib/blog/store';
import { buildCanonicalPath } from '@/lib/seo/urls';

export const BLOG_SITEMAP_CHUNK = 1000;

export const STATIC_SITEMAP_ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/gallery', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/blog', priority: 0.85, changeFrequency: 'daily' },
  { path: '/partner', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/rental-interiors', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/estimate', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/estimate/commercial', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/estimate/office', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/estimate/kitchen', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/estimate/wardrobe', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/estimate/rental-furnishing', priority: 0.75, changeFrequency: 'weekly' },
  { path: '/shade-explorer', priority: 0.6, changeFrequency: 'monthly' },
];

function toSitemapEntry({ path, lastModified, changeFrequency, priority }) {
  return {
    url: absoluteUrl(buildCanonicalPath(path)),
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    changeFrequency,
    priority,
  };
}

export async function getCoreSitemapEntries() {
  const dbSlugs = await loadServiceSlugs();
  const serviceSlugs = dbSlugs.length
    ? dbSlugs
    : DEFAULT_SERVICES.map((service) => service.slug).filter(Boolean);

  const lastModified = new Date();

  return [
    ...STATIC_SITEMAP_ROUTES.map((route) => toSitemapEntry({ ...route, lastModified })),
    ...serviceSlugs.map((slug) => toSitemapEntry({
      path: `/services/${slug}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    })),
  ];
}

export async function getPublishedBlogCount() {
  try {
    const db = await getDatabase();
    return db.collection('blog_posts').countDocuments({ status: 'published' });
  } catch {
    return 0;
  }
}

export async function getBlogSitemapChunkEntries(chunkId = 0) {
  try {
    const db = await getDatabase();
    const posts = await listPublishedSlugs(db, {
      limit: BLOG_SITEMAP_CHUNK,
      skip: chunkId * BLOG_SITEMAP_CHUNK,
    });

    return posts.map((post) => toSitemapEntry({
      path: `/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.65,
    }));
  } catch {
    return [];
  }
}

export async function getSitemapChunkCount() {
  const blogCount = await getPublishedBlogCount();
  const blogChunks = blogCount > 0 ? Math.ceil(blogCount / BLOG_SITEMAP_CHUNK) : 0;
  return 1 + blogChunks;
}
