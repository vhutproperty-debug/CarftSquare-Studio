import { generatePageMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';

export async function generateMetadata() {
  return generatePageMetadata('rentalInteriors', { path: '/rental-interiors' });
}

export default function RentalInteriorsLayout({ children }) {
  return (
    <>
      <JsonLd data={pageBreadcrumb('Rental Interiors', '/rental-interiors')} />
      {children}
    </>
  );
}
