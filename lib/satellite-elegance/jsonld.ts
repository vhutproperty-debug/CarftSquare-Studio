import { absoluteUrl, getSiteUrl } from '@/lib/site';
import { buildCanonicalPath } from '@/lib/seo/urls';

export function buildSatelliteWebPageJsonLd({
  name,
  description,
  path,
  dateModified,
}: {
  name: string;
  description: string;
  path: string;
  dateModified?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: absoluteUrl(buildCanonicalPath(path)),
    dateModified: dateModified || new Date().toISOString().split('T')[0],
    isPartOf: {
      '@id': `${getSiteUrl()}/#website`,
    },
    publisher: {
      '@id': `${getSiteUrl()}/#organization`,
    },
    inLanguage: 'en-IN',
  };
}
