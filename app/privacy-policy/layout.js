import { buildMetadata } from '@/lib/seo/metadata';
import { buildWebPageJsonLd } from '@/lib/seo/jsonld';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { BRAND } from '@/lib/brand';
import JsonLd from '@/components/JsonLd';

const PAGE_PATH = '/privacy-policy';
const PAGE_TITLE = `Privacy Policy | ${BRAND.name}`;
const PAGE_DESCRIPTION =
  'How CraftSquare Studio and CraftSquare Properties collect, use and protect personal information for interiors, painting and property (buy, sell, rent) enquiries in Mumbai, including messaging consent and opt-out.';

export const metadata = buildMetadata({
  seo: {
    metaTitle: PAGE_TITLE,
    metaDescription: PAGE_DESCRIPTION,
    keywords: [
      'CraftSquare privacy policy',
      'interior design privacy Mumbai',
      'painting services data policy',
      'Meta Lead Ads privacy',
    ],
  },
  path: PAGE_PATH,
  fallbackTitle: PAGE_TITLE,
  fallbackDescription: PAGE_DESCRIPTION,
});

export default function PrivacyPolicyLayout({ children }) {
  const dateModified = new Date().toISOString().split('T')[0];

  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd({
          name: 'Privacy Policy',
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
          dateModified,
        })}
      />
      <JsonLd data={pageBreadcrumb('Privacy Policy', PAGE_PATH)} />
      {children}
    </>
  );
}
