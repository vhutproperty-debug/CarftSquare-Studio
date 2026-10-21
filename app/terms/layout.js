import { buildMetadata } from '@/lib/seo/metadata';
import { buildWebPageJsonLd } from '@/lib/seo/jsonld';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { BRAND } from '@/lib/brand';
import JsonLd from '@/components/JsonLd';

const PAGE_PATH = '/terms';
const PAGE_TITLE = `Terms of Use | ${BRAND.name}`;
const PAGE_DESCRIPTION =
  'Terms of Use for the CraftSquare website, WhatsApp messaging, and related interior design and property services in Mumbai.';

export const metadata = buildMetadata({
  seo: {
    metaTitle: PAGE_TITLE,
    metaDescription: PAGE_DESCRIPTION,
    keywords: [
      'CraftSquare terms of use',
      'CraftSquare terms of service',
      'interior design terms Mumbai',
    ],
  },
  path: PAGE_PATH,
  fallbackTitle: PAGE_TITLE,
  fallbackDescription: PAGE_DESCRIPTION,
});

export default function TermsLayout({ children }) {
  const dateModified = new Date().toISOString().split('T')[0];

  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd({
          name: 'Terms of Use',
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
          dateModified,
        })}
      />
      <JsonLd data={pageBreadcrumb('Terms of Use', PAGE_PATH)} />
      {children}
    </>
  );
}
