import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import { absoluteUrl, getMetadataBase } from '@/lib/site';
import { loadPageSeo } from '@/lib/seo/load';

export function buildMetadata({
  seo = {},
  path = '/',
  fallbackTitle,
  fallbackDescription,
  fallbackKeywords = [],
  ogType = 'website',
}) {
  const title = String(seo.metaTitle || fallbackTitle || `${BRAND.name} | Premium Interior Design Mumbai`).trim();
  const description = String(
    seo.metaDescription
    || fallbackDescription
    || 'Transform your space with expert interior design, modular kitchens, wardrobes, rental interiors and turnkey execution in Mumbai.',
  ).trim();
  const canonical = String(seo.canonicalUrl || absoluteUrl(path)).trim();
  const keywords = Array.isArray(seo.keywords) && seo.keywords.length
    ? seo.keywords
    : fallbackKeywords;
  const ogImage = String(seo.ogImage || absoluteLogoUrl).trim();

  return {
    title,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: BRAND.name,
      locale: 'en_IN',
      type: ogType,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export function getRootMetadata() {
  const homeSeo = {
    metaTitle: `${BRAND.name} | Premium Interior Design & Solutions Mumbai`,
    metaDescription: 'Transform your space with expert interior design, modular kitchens, wardrobes, rental interiors and turnkey execution in Mumbai. Book free consultation today.',
    keywords: [
      'Interior Design Mumbai',
      'Modular Kitchen Mumbai',
      'Wardrobe Design Mumbai',
      'Rental Interiors Mumbai',
      'Turnkey Interiors Mumbai',
    ],
    ogImage: absoluteLogoUrl,
    canonicalUrl: absoluteUrl('/'),
  };

  return {
    metadataBase: getMetadataBase(),
    ...buildMetadata({
      seo: homeSeo,
      path: '/',
      fallbackKeywords: homeSeo.keywords,
    }),
    title: {
      default: homeSeo.metaTitle,
      template: `%s | ${BRAND.name}`,
    },
    icons: {
      icon: BRAND.logoUrl, // .png via brand.js
      apple: BRAND.logoUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generatePageMetadata(pageKey, options = {}) {
  const seo = await loadPageSeo(pageKey);
  return buildMetadata({
    seo,
    path: options.path || '/',
    fallbackTitle: options.fallbackTitle,
    fallbackDescription: options.fallbackDescription,
    fallbackKeywords: options.fallbackKeywords || [],
    ogType: options.ogType || 'website',
  });
}
