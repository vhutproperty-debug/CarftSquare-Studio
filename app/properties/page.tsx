import { buildMetadata } from '@/lib/seo/metadata';
import { buildWebPageJsonLd } from '@/lib/seo/jsonld';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { absoluteUrl } from '@/lib/site';
import JsonLd from '@/components/JsonLd';
import PropertiesPageClient from '@/components/properties/PropertiesPageClient';
import {
  PROPERTIES_BRAND_NAME,
  PROPERTIES_PAGE_PATH,
  PROPERTIES_PHONE_E164,
} from '@/lib/properties/constants';

const PAGE_TITLE = 'CraftSquare Properties | Buy, Sell & Rent Homes in Mumbai';
const PAGE_DESCRIPTION =
  'CraftSquare Properties helps you buy, sell and rent homes in Mumbai’s western suburbs, Goregaon to Borivali, with home interiors through CraftSquare Studio. Contact Arun Pandey, 90224 04260.';

export const metadata = buildMetadata({
  seo: {
    metaTitle: PAGE_TITLE,
    metaDescription: PAGE_DESCRIPTION,
    keywords: [
      'CraftSquare Properties',
      'property consultant Mumbai',
      'flats for rent Goregaon',
      'buy flat Malad Kandivali Borivali',
      'sell flat Mumbai western suburbs',
      'rent out flat Mumbai',
    ],
  },
  path: PROPERTIES_PAGE_PATH,
  fallbackTitle: PAGE_TITLE,
  fallbackDescription: PAGE_DESCRIPTION,
  robots: { index: true, follow: true },
});

export default function PropertiesPage() {
  const dateModified = new Date().toISOString().split('T')[0];
  const url = absoluteUrl(PROPERTIES_PAGE_PATH);

  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd({
          name: PROPERTIES_BRAND_NAME,
          description: PAGE_DESCRIPTION,
          path: PROPERTIES_PAGE_PATH,
          dateModified,
        })}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'RealEstateAgent',
          name: PROPERTIES_BRAND_NAME,
          url,
          telephone: PROPERTIES_PHONE_E164,
          image: absoluteUrl('/branding/craftsquare-studio-logo.png'),
          address: { '@type': 'PostalAddress', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', addressCountry: 'IN' },
          areaServed: ['Goregaon', 'Malad', 'Kandivali', 'Borivali', 'Mumbai Western Suburbs'],
          employee: { '@type': 'Person', name: 'Arun Pandey', telephone: PROPERTIES_PHONE_E164 },
        }}
      />
      <JsonLd data={pageBreadcrumb('Properties', PROPERTIES_PAGE_PATH)} />
      <PropertiesPageClient />
    </>
  );
}
