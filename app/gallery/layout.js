import { generatePageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return generatePageMetadata('gallery', { path: '/gallery' });
}

export default function GalleryLayout({ children }) {
  return children;
}
