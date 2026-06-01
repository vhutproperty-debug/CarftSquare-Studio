import { generatePageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return generatePageMetadata('rentalInteriors', { path: '/rental-interiors' });
}

export default function RentalInteriorsLayout({ children }) {
  return children;
}
