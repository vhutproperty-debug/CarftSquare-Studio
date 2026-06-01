import { generatePageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return generatePageMetadata('shadeExplorer', { path: '/shade-explorer' });
}

export default function ShadeExplorerLayout({ children }) {
  return children;
}
