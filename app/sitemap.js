import { DEFAULT_SERVICES } from '@/lib/cms/defaults';
import { absoluteUrl } from '@/lib/site';
import { loadServiceSlugs } from '@/lib/seo/load';

export default async function sitemap() {
  const staticRoutes = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/gallery', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/rental-interiors', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/shade-explorer', priority: 0.6, changeFrequency: 'monthly' },
  ];

  const dbSlugs = await loadServiceSlugs();
  const serviceSlugs = dbSlugs.length
    ? dbSlugs
    : DEFAULT_SERVICES.map((service) => service.slug).filter(Boolean);

  const lastModified = new Date();

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...serviceSlugs.map((slug) => ({
      url: absoluteUrl(`/services/${slug}`),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    })),
  ];
}
