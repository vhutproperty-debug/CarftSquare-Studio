import { revalidatePath } from 'next/cache';

const SITEMAP_PATHS = ['/sitemap.xml'];

export function revalidatePublishedBlogRoutes(slug) {
  try {
    revalidatePath('/blog');
    if (slug) {
      revalidatePath(`/blog/${slug}`);
    }
    SITEMAP_PATHS.forEach((path) => revalidatePath(path));
  } catch {
    // revalidatePath is only available in server contexts.
  }
}

export function revalidateSitemap() {
  try {
    SITEMAP_PATHS.forEach((path) => revalidatePath(path));
  } catch {
    // no-op outside server action / route handler context
  }
}
