import { generatePageMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata() {
  return generatePageMetadata('shadeExplorer', { path: '/shade-explorer' });
}

export default function ShadeExplorerLayout({ children }) {
  return (
    <>
      <JsonLd data={pageBreadcrumb('Shade Explorer', '/shade-explorer')} />
      {children}
    </>
  );
}
