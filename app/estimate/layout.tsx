import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Interior Estimate | CraftSquare Studio',
  description: 'Get an AI-assisted interior design estimate and personalised recommendations from CraftSquare Studio.',
  robots: { index: true, follow: true },
};

export default function EstimateRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
