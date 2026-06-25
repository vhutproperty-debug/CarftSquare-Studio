import { buildMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { SEO_KEYWORDS } from '@/lib/painting/content';
import JsonLd from '@/components/JsonLd';

export const metadata = buildMetadata({
  seo: {
    metaTitle: 'Painting Services Mumbai | Home & Interior Painting | CraftSquare Studio',
    metaDescription:
      'Premium painting services in Mumbai — interior, exterior, texture, waterproofing, and society painting. Professional painters, premium paints, free site inspection. Book today.',
    keywords: SEO_KEYWORDS,
  },
  path: '/painting',
  fallbackKeywords: SEO_KEYWORDS,
});

export default function PaintingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            pageBreadcrumb('Painting Services Mumbai', '/painting'),
            {
              '@type': 'Service',
              name: 'Premium Painting Services Mumbai',
              provider: { '@type': 'LocalBusiness', name: 'CraftSquare Studio' },
              areaServed: { '@type': 'City', name: 'Mumbai' },
              description:
                'Professional home painting, interior painting, exterior painting, texture painting, and waterproof coating in Mumbai.',
            },
          ],
        }}
      />
      {children}
    </>
  );
}
