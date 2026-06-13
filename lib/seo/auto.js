const DESCRIPTION_MAX = 160;
const TITLE_MAX = 60;

export const SEO_DEFAULTS = {
  descriptionMax: DESCRIPTION_MAX,
  titleMax: TITLE_MAX,
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE?.trim() || '@CraftSquare_St',
  locale: 'en_IN',
  language: 'en',
};

export function truncateDescription(value = '', max = DESCRIPTION_MAX) {
  const clean = String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
  return `${trimmed}…`;
}

export function truncateTitle(value = '', max = TITLE_MAX) {
  const clean = String(value).replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function stripHtml(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildAutoTitle(title, brandName, suffix = '') {
  const base = String(title || '').trim();
  if (!base) return '';
  const withSuffix = suffix ? `${base} ${suffix}`.trim() : base;
  const withBrand = withSuffix.includes(brandName) ? withSuffix : `${withSuffix} | ${brandName}`;
  return truncateTitle(withBrand, 70);
}

export function buildAutoDescription({ excerpt, content, fallback } = {}) {
  const fromExcerpt = truncateDescription(excerpt || '');
  if (fromExcerpt) return fromExcerpt;
  const fromContent = truncateDescription(stripHtml(content || ''));
  if (fromContent) return fromContent;
  return truncateDescription(fallback || '');
}

export function buildAutoKeywords({ category, tags = [], extras = [] } = {}) {
  return [...new Set([category, ...tags, ...extras].map((item) => String(item || '').trim()).filter(Boolean))];
}

export function buildAutoBlogSeo(post, slug, brandName) {
  const path = `/blog/${slug}`;
  return {
    metaTitle: buildAutoTitle(post?.title, brandName, 'Blog'),
    metaDescription: buildAutoDescription({
      excerpt: post?.excerpt,
      content: post?.content,
      fallback: `Read ${post?.title || 'this article'} on the ${brandName} interior design blog.`,
    }),
    keywords: buildAutoKeywords({
      category: post?.category,
      tags: post?.tags,
      extras: ['Interior Design Mumbai', brandName],
    }),
    ogImage: post?.featuredImage || '',
    canonicalUrl: '',
    path,
    article: {
      publishedTime: post?.publishedAt,
      modifiedTime: post?.updatedAt || post?.publishedAt,
      authors: [post?.author?.name || brandName],
      section: post?.category,
      tags: post?.tags || [],
    },
  };
}

export function buildAutoServiceSeo(service, slug, brandName) {
  return {
    metaTitle: buildAutoTitle(service?.name, brandName, 'Mumbai'),
    metaDescription: buildAutoDescription({
      excerpt: service?.shortDescription || service?.description,
      fallback: `${service?.name || 'Interior service'} by ${brandName} in Mumbai.`,
    }),
    keywords: buildAutoKeywords({
      extras: [
        `${service?.name || ''} Mumbai`,
        'Interior Design Mumbai',
        brandName,
      ],
    }),
    ogImage: service?.heroImage || '',
    path: `/services/${slug}`,
  };
}
