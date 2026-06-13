import { generatePageMetadata } from '@/lib/seo/metadata';
import { buildHomeJsonLd } from '@/lib/seo/jsonld';
import { homeBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';
import HomePageClient from './HomePageClient';

export async function generateMetadata() {
  return generatePageMetadata('home', { path: '/' });
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={buildHomeJsonLd()} />
      <JsonLd data={homeBreadcrumb()} />
      <HomePageClient />
    </>
  );
}
