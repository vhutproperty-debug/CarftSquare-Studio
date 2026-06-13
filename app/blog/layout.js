import { generatePageMetadata } from '@/lib/seo/metadata';
import { buildCollectionPageJsonLd } from '@/lib/seo/jsonld';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata() {
  return generatePageMetadata('blog', {
    path: '/blog',
    fallbackTitle: 'Interior Design Blog | CraftSquare Studio Mumbai',
    fallbackDescription: 'Expert interior design insights, modular kitchen tips, rental furnishing guides and Mumbai home inspiration.',
    ogType: 'website',
  });
}

export default function BlogLayout({ children }) {
  return (
    <>
      <JsonLd
        data={buildCollectionPageJsonLd({
          name: 'CraftSquare Studio Interior Design Blog',
          description: 'Interior design insights, modular kitchen tips, and Mumbai home inspiration.',
          path: '/blog',
        })}
      />
      <JsonLd data={pageBreadcrumb('Blog', '/blog')} />
      {children}
    </>
  );
}
