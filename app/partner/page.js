import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/site';
import JsonLd from '@/components/JsonLd';
import PartnerPageClient from '@/components/partner-network/PartnerPageClient';

const PAGE_DESCRIPTION =
  'Join the CraftSquare Partner Network and help homeowners and landlords with professional interior solutions while building long-term business opportunities through technology-driven partnerships.';

export const metadata = buildMetadata({
  path: '/partner',
  fallbackTitle: 'CraftSquare Partner Network | Interior Partner Program Mumbai',
  fallbackDescription: PAGE_DESCRIPTION,
  fallbackKeywords: ['partner network', 'interior partner program', 'property consultant', 'Mumbai brokers', 'rental interiors'],
});

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'Partner Network', item: absoluteUrl('/partner') },
  ],
};

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'CraftSquare Partner Network',
  description: PAGE_DESCRIPTION,
  url: absoluteUrl('/partner'),
  isPartOf: { '@type': 'WebSite', name: 'CraftSquare Studio', url: absoluteUrl('/') },
};

export default function PartnerPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={orgSchema} />
      <PartnerPageClient />
    </>
  );
}
