export const RESEARCH_PRODUCT = {
  name: 'Prop/Research',
  shortName: 'Research',
  tagline: 'AI-powered property research workspace',
  homeHref: '/research/research',
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

/** Presentation-only sidebar groups (does not change routes). */
export type ResearchNavGroup = {
  id: string;
  label: string;
  items: ResearchNavItem[];
};

export const RESEARCH_NAV_ITEMS: ResearchNavItem[] = [
  { label: 'Research', href: '/research/research', icon: 'research' },
  { label: 'Dashboard', href: '/research/dashboard', icon: 'dashboard' },
  { label: 'Inventory Search', href: '/research/inventory', icon: 'inventory' },
  { label: 'Watchlists', href: '/research/watches', icon: 'watches' },
  { label: 'Knowledge Explorer', href: '/research/knowledge', icon: 'knowledge' },
  { label: 'Saved Reports', href: '/research/saved-searches', icon: 'saved' },
  { label: 'History', href: '/research/history', icon: 'history' },
  { label: 'Connectors', href: '/research/connectors', icon: 'connectors' },
  { label: 'Notifications', href: '/research/notifications', icon: 'notifications' },
  { label: 'Operations', href: '/research/operations', icon: 'operations' },
  { label: 'Health', href: '/research/health', icon: 'health' },
  { label: 'Settings', href: '/research/settings', icon: 'settings' },
];

export const RESEARCH_NAV_GROUPS: ResearchNavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { label: 'Research', href: '/research/research', icon: 'research' },
      { label: 'Dashboard', href: '/research/dashboard', icon: 'dashboard' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { label: 'Inventory Search', href: '/research/inventory', icon: 'inventory' },
      { label: 'Watchlists', href: '/research/watches', icon: 'watches' },
      { label: 'Knowledge Explorer', href: '/research/knowledge', icon: 'knowledge' },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      { label: 'Saved Reports', href: '/research/saved-searches', icon: 'saved' },
      { label: 'History', href: '/research/history', icon: 'history' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { label: 'Connectors', href: '/research/connectors', icon: 'connectors' },
      { label: 'Notifications', href: '/research/notifications', icon: 'notifications' },
      { label: 'Operations', href: '/research/operations', icon: 'operations' },
      { label: 'Health', href: '/research/health', icon: 'health' },
      { label: 'Settings', href: '/research/settings', icon: 'settings' },
    ],
  },
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
