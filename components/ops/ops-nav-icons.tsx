import {
  ArrowLeftRight,
  BarChart3,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  PhoneCall,
  TrendingUp,
} from 'lucide-react';
import type { OpsNavItem } from '@/lib/ops/business';

const ICONS = {
  overview: LayoutDashboard,
  demand: Inbox,
  supply: PhoneCall,
  matching: ArrowLeftRight,
  deal: Handshake,
  revenue: TrendingUp,
  agreement: FileText,
  intelligence: BarChart3,
} as const;

export function OpsNavIcon({ icon, className }: { icon: OpsNavItem['icon']; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
