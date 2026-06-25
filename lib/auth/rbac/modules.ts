/** Pluggable module keys — register new CMS modules here. */
export const MODULES = {
  DASHBOARD: 'dashboard',
  BLOG: 'blog',
  GALLERY: 'gallery',
  PROJECTS: 'projects',
  REVIEWS: 'reviews',
  LEADS: 'leads',
  AI_QUOTES: 'ai_quotes',
  CUSTOMERS: 'customers',
  ANALYTICS: 'analytics',
  MARKETING: 'marketing',
  TEAM: 'team',
  CONTACT_ENQUIRIES: 'contact_enquiries',
  TESTIMONIALS: 'testimonials',
  SETTINGS: 'settings',
  PARTNER_NETWORK: 'partner_network',
  PAINTING: 'painting',
  FUTURE_MODULES: 'future_modules',
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

export const MODULE_KEYS: ModuleKey[] = Object.values(MODULES);

/** @deprecated Use MODULES — kept for existing route guards. */
export const PERMISSIONS = MODULES;

/** @deprecated Use ModuleKey */
export type Permission = ModuleKey;

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  blog: 'Blog',
  gallery: 'Gallery',
  projects: 'Projects',
  reviews: 'Reviews',
  leads: 'Leads',
  ai_quotes: 'AI Quotes',
  customers: 'Customers',
  analytics: 'Analytics',
  marketing: 'Marketing',
  team: 'Team',
  contact_enquiries: 'Contact Enquiries',
  testimonials: 'Testimonials',
  settings: 'Settings',
  partner_network: 'Partner Network',
  painting: 'Painting Services',
  future_modules: 'Future Modules',
};

/** @deprecated */
export const PERMISSION_LABELS = MODULE_LABELS;

/** @deprecated */
export const ALL_PERMISSIONS: ModuleKey[] = MODULE_KEYS;
