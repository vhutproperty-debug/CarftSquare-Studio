import {
  Activity,
  Bell,
  Bookmark,
  Building2,
  Eye,
  Gauge,
  History,
  LayoutDashboard,
  Network,
  Plug,
  Search,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ResearchNavItem } from '@/lib/research/business';

const ICONS: Record<ResearchNavItem['icon'], LucideIcon> = {
  dashboard: LayoutDashboard,
  research: Search,
  knowledge: Network,
  inventory: Building2,
  watches: Eye,
  notifications: Bell,
  operations: Gauge,
  health: Activity,
  saved: Bookmark,
  history: History,
  connectors: Plug,
  settings: Settings,
};

export function ResearchNavIcon({
  icon,
  className,
}: {
  icon: ResearchNavItem['icon'];
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={className} />;
}
