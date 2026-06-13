import { generatePageMetadata } from '@/lib/seo/metadata';
import { buildOrganizationSchema } from '@/lib/seo/jsonld';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata() {
  return generatePageMetadata('about', { path: '/about' });
}

export default function AboutLayout({ children }) {
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', ...buildOrganizationSchema() }} />
      <JsonLd data={pageBreadcrumb('About', '/about')} />
      {children}
    </>
  );
}
