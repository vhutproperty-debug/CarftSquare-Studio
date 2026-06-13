import { generatePageMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata() {
  return generatePageMetadata('estimate', {
    path: '/estimate',
    fallbackTitle: 'AI Interior Estimate | CraftSquare Studio',
    fallbackDescription: 'Get an AI-assisted interior design estimate and personalised recommendations from CraftSquare Studio in Mumbai.',
  });
}

export default function EstimateRootLayout({ children }) {
  return (
    <>
      <JsonLd data={pageBreadcrumb('AI Estimate', '/estimate')} />
      {children}
    </>
  );
}
