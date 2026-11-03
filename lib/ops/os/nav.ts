import type { AdminRole } from '@/lib/auth/rbac/roles';
import { ROLES } from '@/lib/auth/rbac/roles';
import type { OpsNavItem } from '@/lib/ops/business';

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
    if (href.startsWith('/ops/broker-portal') || href.startsWith('/ops/portal')) return false;
    return true;
  }
  if (role === ROLES.BROKER) return matches(href, BROKER_PREFIXES);
  if (role === ROLES.INTERIOR) return matches(href, INTERIOR_PREFIXES);
  if (role === ROLES.SALES_EXEC) return matches(href, SALES_PREFIXES);
  if (role === ROLES.OPS_EXEC) return matches(href, OPS_PREFIXES);
  return true;
}

export function filterOpsNav<T extends NavSection>(sections: T[], role: string | null | undefined): T[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => navHrefVisible(role, item.href)),
    }))
    .filter((section) => section.items.length > 0);
}

export function roleCanOpenOps(role: AdminRole | string | null | undefined): boolean {
  return Boolean(role);
}
