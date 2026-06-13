import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import { absoluteUrl, getSiteUrl } from '@/lib/site';
import { buildCanonicalPath } from '@/lib/seo/urls';

export function buildLocalBusinessSchema() {
  return {
    '@type': 'LocalBusiness',
    '@id': `${getSiteUrl()}/#localbusiness`,
    name: BRAND.name,
    url: absoluteUrl('/'),
    image: absoluteLogoUrl,
    logo: absoluteLogoUrl,
    telephone: BRAND.phone,
    email: BRAND.emailTo,
    areaServed: {
      '@type': 'City',
      name: BRAND.city,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: BRAND.city,
      addressCountry: 'IN',
    },
    priceRange: '₹₹₹',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '850',
    },
  };
}

export function buildWebSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${getSiteUrl()}/#website`,
    name: BRAND.name,
    url: absoluteUrl('/'),
    inLanguage: 'en-IN',
    publisher: {
      '@id': `${getSiteUrl()}/#organization`,
    },
  };
}

export function buildOrganizationSchema() {
  return {
    '@type': 'Organization',
    '@id': `${getSiteUrl()}/#organization`,
    name: BRAND.name,
    url: absoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: absoluteLogoUrl,
      width: 512,
      height: 512,
    },
    image: absoluteLogoUrl,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BRAND.phone,
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['English', 'Hindi'],
    },
  };
}

export function buildHomeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildOrganizationSchema(),
      buildWebSiteSchema(),
      {
        ...buildLocalBusinessSchema(),
        makesOffer: [
          'Interior Design Mumbai',
          'Residential Interiors Mumbai',
          'Commercial Interiors Mumbai',
          'Rental Interiors Mumbai',
          'Modular Kitchen Mumbai',
          'Wardrobe Design Mumbai',
          'Turnkey Interiors Mumbai',
          'Home Renovation Mumbai',
          'Interior Styling Mumbai',
        ],
      },
    ],
  };
}

export function buildServiceJsonLd(service, slug) {
  if (!service) return null;

  const url = absoluteUrl(buildCanonicalPath(`/services/${slug}`));

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.shortDescription || service.description,
    url,
    provider: {
      '@id': `${getSiteUrl()}/#organization`,
    },
    areaServed: {
      '@type': 'City',
      name: BRAND.city,
    },
    image: service.heroImage || absoluteLogoUrl,
  };
}

export function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildCollectionPageJsonLd({ name, description, path }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: absoluteUrl(buildCanonicalPath(path)),
    isPartOf: {
      '@id': `${getSiteUrl()}/#website`,
    },
    publisher: {
      '@id': `${getSiteUrl()}/#organization`,
    },
  };
}

export function buildArticleJsonLd(post, slug) {
  if (!post) return null;

  const url = absoluteUrl(buildCanonicalPath(`/blog/${slug}`));

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.excerpt,
    image: {
      '@type': 'ImageObject',
      url: post.featuredImage || absoluteLogoUrl,
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Person',
      name: post.author?.name || BRAND.name,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: {
        '@type': 'ImageObject',
        url: absoluteLogoUrl,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    url,
    articleSection: post.category,
    keywords: Array.isArray(post.tags) ? post.tags.join(', ') : undefined,
    inLanguage: 'en-IN',
    isAccessibleForFree: true,
  };
}
