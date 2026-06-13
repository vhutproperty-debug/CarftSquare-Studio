import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import { absoluteUrl, getMetadataBase } from '@/lib/site';
import { loadPageSeo } from '@/lib/seo/load';
import { truncateDescription, buildAutoBlogSeo, buildAutoServiceSeo, SEO_DEFAULTS } from '@/lib/seo/auto';
import { buildCanonicalPath } from '@/lib/seo/urls';

function resolveOgImage(ogImage) {
  const image = String(ogImage || absoluteLogoUrl).trim();
  if (image.startsWith('http')) return image;
  return absoluteUrl(image);
}

function resolveCanonical(path, canonicalUrl) {
  if (canonicalUrl) return String(canonicalUrl).trim();
  return absoluteUrl(buildCanonicalPath(path));
}

function buildTitleValue(title) {
  const value = String(title || '').trim();
  if (!value) return undefined;
  return { absolute: value };
}

export function buildMetadata({
  seo = {},
  path = '/',
  fallbackTitle,
  fallbackDescription,
  fallbackKeywords = [],
  ogType = 'website',
  article = null,
  robots = { index: true, follow: true },
}) {
  const title = String(seo.metaTitle || fallbackTitle || `${BRAND.name} | Premium Interior Design Mumbai`).trim();
  const description = truncateDescription(
    seo.metaDescription
      || fallbackDescription
      || 'Transform your space with expert interior design, modular kitchens, wardrobes, rental interiors and turnkey execution in Mumbai.',
  );
  const canonical = resolveCanonical(path, seo.canonicalUrl);
  const keywords = Array.isArray(seo.keywords) && seo.keywords.length
    ? seo.keywords
    : fallbackKeywords;
  const ogImage = resolveOgImage(seo.ogImage);
  const twitterHandle = SEO_DEFAULTS.twitterHandle;

  const openGraph = {
    title,
    description,
    url: canonical,
    siteName: BRAND.name,
    locale: SEO_DEFAULTS.locale,
    type: ogType,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: title,
        type: 'image/jpeg',
      },
    ],
  };

  if (ogType === 'article' && article) {
    openGraph.publishedTime = article.publishedTime;
    openGraph.modifiedTime = article.modifiedTime || article.publishedTime;
    openGraph.authors = article.authors?.filter(Boolean);
    openGraph.section = article.section;
    openGraph.tags = article.tags?.filter(Boolean);
  }

  return {
    metadataBase: getMetadataBase(),
    title: buildTitleValue(title),
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: {
      canonical,
    },
    robots: {
      index: robots.index !== false,
      follow: robots.follow !== false,
      googleBot: {
        index: robots.index !== false,
        follow: robots.follow !== false,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      site: twitterHandle,
      creator: twitterHandle,
      title,
      description,
      images: {
        url: ogImage,
        alt: title,
      },
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
      icon: BRAND.logoUrl,
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
    robots: options.robots,
  });
}

export function buildBlogPostMetadata(post, slug) {
  const auto = buildAutoBlogSeo(post, slug, BRAND.name);
  const seo = post?.seo?.metaTitle
    ? {
      ...post.seo,
      canonicalUrl: post.seo.canonicalUrl || absoluteUrl(buildCanonicalPath(`/blog/${slug}`)),
      ogImage: post.seo.ogImage || post.featuredImage || absoluteLogoUrl,
    }
    : {
      metaTitle: auto.metaTitle,
      metaDescription: auto.metaDescription,
      keywords: auto.keywords,
      ogImage: auto.ogImage || absoluteLogoUrl,
      canonicalUrl: absoluteUrl(buildCanonicalPath(`/blog/${slug}`)),
    };

  return buildMetadata({
    seo,
    path: `/blog/${slug}`,
    ogType: 'article',
    article: auto.article,
  });
}

export function buildServiceMetadata(service, slug) {
  const auto = buildAutoServiceSeo(service, slug, BRAND.name);
  const seo = service?.seo?.metaTitle
    ? {
      ...service.seo,
      canonicalUrl: service.seo.canonicalUrl || absoluteUrl(buildCanonicalPath(`/services/${slug}`)),
      ogImage: service.seo.ogImage || service.heroImage || absoluteLogoUrl,
    }
    : {
      metaTitle: auto.metaTitle,
      metaDescription: auto.metaDescription,
      keywords: auto.keywords,
      ogImage: auto.ogImage || absoluteLogoUrl,
      canonicalUrl: absoluteUrl(buildCanonicalPath(`/services/${slug}`)),
    };

  return buildMetadata({
    seo,
    path: `/services/${slug}`,
    ogType: 'website',
  });
}
