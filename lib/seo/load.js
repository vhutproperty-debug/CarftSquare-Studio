import { getDb } from '@/lib/mongodb';
import { DEFAULT_SEO_SETTINGS } from '@/lib/cms/defaults';
import { getPublicSeo, getPublicServiceBySlug, getPublicServices } from '@/lib/cms/handlers';

function defaultSeoForPage(pageKey) {
  return DEFAULT_SEO_SETTINGS.pages[pageKey] || DEFAULT_SEO_SETTINGS.pages.home;
}

export async function loadPageSeo(pageKey) {
  try {
    const db = await getDb();
    const result = await getPublicSeo(db, pageKey);
    return result.seo || defaultSeoForPage(pageKey);
  } catch {
    return defaultSeoForPage(pageKey);
  }
}

export async function loadServiceBySlug(slug) {
  try {
    const db = await getDb();
    return getPublicServiceBySlug(db, slug);
  } catch {
    return null;
  }
}

export async function loadServiceSlugs() {
  try {
    const db = await getDb();
    const { services } = await getPublicServices(db);
    return services.map((service) => service.slug).filter(Boolean);
  } catch {
    return [];
  }
}
