export const RESEARCH_PRODUCT = {
  name: 'Prop/Research',
  shortName: 'Research',
  tagline: 'AI-powered property research workspace',
  homeHref: '/research/dashboard',
} as const;

export type ResearchNavItem = {
  label: string;
  href: string;
  icon:
    | 'dashboard'
    | 'research'
    | 'knowledge'
    | 'inventory'
    | 'watches'
    | 'notifications'
    | 'operations'
    | 'health'
    | 'saved'
    | 'history'
    | 'connectors'
    | 'settings';
  exact?: boolean;
};

export const RESEARCH_NAV_ITEMS: ResearchNavItem[] = [
  { label: 'Dashboard', href: '/research/dashboard', icon: 'dashboard' },
  { label: 'Research', href: '/research/research', icon: 'research' },
  { label: 'Knowledge', href: '/research/knowledge', icon: 'knowledge' },
  { label: 'Inventory', href: '/research/inventory', icon: 'inventory' },
  { label: 'Watches', href: '/research/watches', icon: 'watches' },
  { label: 'Notifications', href: '/research/notifications', icon: 'notifications' },
  { label: 'Operations', href: '/research/operations', icon: 'operations' },
  { label: 'Health', href: '/research/health', icon: 'health' },
  { label: 'Saved Searches', href: '/research/saved-searches', icon: 'saved' },
  { label: 'History', href: '/research/history', icon: 'history' },
  { label: 'Connectors', href: '/research/connectors', icon: 'connectors' },
  { label: 'Settings', href: '/research/settings', icon: 'settings' },
];

/** Default workspace shown in the workspace selector until multi-workspace lands. */
export const DEFAULT_RESEARCH_WORKSPACE = {
  id: 'workspace-default',
  name: 'Primary Workspace',
} as const;

export const RESEARCH_DASHBOARD_PLACEHOLDERS = {
  researchRuns: 0,
  connectedPortals: 0,
  recentSearches: 0,
  savedSearches: 0,
  todaysActivity: 0,
} as const;
