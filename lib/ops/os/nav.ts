import type { AdminRole } from '@/lib/auth/rbac/roles';
import { ROLES } from '@/lib/auth/rbac/roles';
import type { OpsNavItem } from '@/lib/ops/business';
import type { GrowthModule } from '@/lib/ops/os/flags';

type NavSection = {
  pillar: string;
  label: string;
  items: OpsNavItem[];
};

const SALES_PREFIXES = [
  '/ops',
  '/ops/leads',
  '/ops/deals',
  '/ops/matching',
  '/ops/contacts',
  '/ops/site-visits',
  '/ops/requirements',
  '/ops/inbox',
  '/ops/finance',
  '/ops/revenue',
  '/ops/growth',
];

const OPS_PREFIXES = [
  '/ops',
  '/ops/contacts',
  '/ops/supply',
  '/ops/calls',
  '/ops/agreements',
  '/ops/projects',
  '/ops/outreach',
  '/ops/inventory',
  '/ops/portfolio-owners',
  '/ops/rerent',
  '/ops/growth',
];

const INTERIOR_PREFIXES = ['/ops', '/ops/interior', '/ops/leads', '/ops/requirements'];

const BROKER_PREFIXES = ['/ops', '/ops/broker-portal', '/ops/portal'];

function matches(href: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => href === prefix || (prefix !== '/ops' && href.startsWith(`${prefix}/`)));
}

/**
 * Hides nav entries for a role. The underlying pages stay registered.
 * Unknown roles keep the existing staff nav, except user management.
 */
export function navHrefVisible(role: string | null | undefined, href: string | undefined): boolean {
  if (!href) return false;
  if (href === '/ops/users' || href.startsWith('/ops/users/')) {
    return role === ROLES.SUPER_ADMIN;
  }
  if (!role || role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN) {
    return true;
  }
  if (role === ROLES.BROKER) return matches(href, BROKER_PREFIXES);
  if (role === ROLES.INTERIOR) return matches(href, INTERIOR_PREFIXES);
  if (role === ROLES.SALES_EXEC) return matches(href, SALES_PREFIXES);
  if (role === ROLES.OPS_EXEC) return matches(href, OPS_PREFIXES);
  return true;
}

const PHASE_PREFIXES: Array<{ prefix: string; phase: number }> = [
  { prefix: '/ops/contacts/duplicates', phase: 1 },
  { prefix: '/ops/broker-portal', phase: 3 },
  { prefix: '/ops/requirements', phase: 3 },
  { prefix: '/ops/site-visits', phase: 4 },
  { prefix: '/ops/inventory', phase: 2 },
  { prefix: '/ops/interior', phase: 6 },
  { prefix: '/ops/finance', phase: 5 },
  { prefix: '/ops/inbox', phase: 3 },
  { prefix: '/ops/users', phase: 0 },
];

const GROWTH_PREFIXES: Array<{ prefix: string; module: GrowthModule }> = [
  { prefix: '/ops/growth/campaigns', module: 'CAMPAIGN_STUDIO' },
  { prefix: '/ops/growth/capture', module: 'LEAD_CAPTURE' },
  { prefix: '/ops/growth/demand', module: 'DEMAND_PROFILER' },
  { prefix: '/ops/growth/intelligence', module: 'LEAD_INTELLIGENCE' },
  { prefix: '/ops/growth/followup', module: 'FOLLOWUP' },
  { prefix: '/ops/growth/revenue', module: 'REVENUE' },
];

/** Growth screens stay hidden until their own CSOS_P7_* flag is on. */
export function growthAllowsHref(href: string | undefined, enabled: ReadonlySet<string> | null | undefined): boolean {
  if (!href) return false;
  const match = GROWTH_PREFIXES.find((item) => href === item.prefix || href.startsWith(`${item.prefix}/`));
  if (!match) return true;
  return Boolean(enabled?.has(match.module));
}

/** New screens stay out of the nav until their CSOS_PHASE_N flag is on. Existing pages have no phase. */
export function phaseAllowsHref(href: string | undefined, enabled: ReadonlySet<number> | null | undefined): boolean {
  if (!href) return false;
  if (!enabled) return true;
  const match = PHASE_PREFIXES.find((item) => href === item.prefix || href.startsWith(`${item.prefix}/`));
  if (!match) return true;
  return enabled.has(match.phase);
}

export function filterOpsNav<T extends NavSection>(
  sections: T[],
  role: string | null | undefined,
  enabled?: ReadonlySet<number> | null,
  growth?: ReadonlySet<string> | null,
): T[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => navHrefVisible(role, item.href) && phaseAllowsHref(item.href, enabled) && growthAllowsHref(item.href, growth)),
    }))
    .filter((section) => section.items.length > 0);
}

export function roleCanOpenOps(role: AdminRole | string | null | undefined): boolean {
  return Boolean(role);
}
