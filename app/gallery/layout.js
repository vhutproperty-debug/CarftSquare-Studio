import { generatePageMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata() {
  return generatePageMetadata('gallery', { path: '/gallery' });
}

export default function GalleryLayout({ children }) {
  return (
    <>
      <JsonLd data={pageBreadcrumb('Gallery', '/gallery')} />
      {children}
    </>
  );
}
