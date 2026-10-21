import { buildMetadata } from '@/lib/seo/metadata';
import { buildWebPageJsonLd } from '@/lib/seo/jsonld';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { BRAND } from '@/lib/brand';
import JsonLd from '@/components/JsonLd';

const PAGE_PATH = '/data-deletion';
const PAGE_TITLE = `Data Deletion | ${BRAND.name}`;
const PAGE_DESCRIPTION =
  'How to request deletion of personal data held by CraftSquare Studio, including website, WhatsApp, and Meta lead enquiries.';

export const metadata = buildMetadata({
  seo: {
    metaTitle: PAGE_TITLE,
    metaDescription: PAGE_DESCRIPTION,
    keywords: ['CraftSquare data deletion', 'delete my data CraftSquare'],
  },
  path: PAGE_PATH,
  fallbackTitle: PAGE_TITLE,
  fallbackDescription: PAGE_DESCRIPTION,
});

export default function DataDeletionLayout({ children }) {
  const dateModified = new Date().toISOString().split('T')[0];

  return (
    <>
      <JsonLd
        data={buildWebPageJsonLd({
          name: 'Data Deletion',
          description: PAGE_DESCRIPTION,
          path: PAGE_PATH,
          dateModified,
        })}
      />
      <JsonLd data={pageBreadcrumb('Data Deletion', PAGE_PATH)} />
      {children}
    </>
  );
}
