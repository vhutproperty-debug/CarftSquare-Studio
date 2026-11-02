import {
  ArrowLeftRight,
  BarChart3,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  MessageCircle,
  MessagesSquare,
  PhoneCall,
  Plug,
  TrendingUp,
  Timer,
  Megaphone,
  Building2,
  Users,
} from 'lucide-react';
import type { OpsNavItem } from '@/lib/ops/business';

const ICONS = {
  overview: LayoutDashboard,
  demand: Inbox,
  supply: PhoneCall,
  matching: ArrowLeftRight,
  market: LayoutGrid,
  deal: Handshake,
  revenue: TrendingUp,
  agreement: FileText,
  intelligence: BarChart3,
  integrations: Plug,
  brokers: MessagesSquare,
  contacts: Users,
  whatsapp: MessageCircle,
  automation: Timer,
  campaigns: Megaphone,
  projects: Building2,
} as const;

export function OpsNavIcon({ icon, className }: { icon: OpsNavItem['icon']; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
