import type { Metadata } from 'next';
import OpsAuthGate from '@/components/ops/OpsAuthGate';

export const metadata: Metadata = {
  title: 'Operations – CraftSquare Studio',
  robots: { index: false, follow: false },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <OpsAuthGate>{children}</OpsAuthGate>;
}
