import { methodToAction, type ActionKey } from '@/lib/auth/rbac/actions';
import { MODULES, type ModuleKey } from '@/lib/auth/rbac/modules';

type RoutePermissionRule = {
  method?: string;
  pathPrefix: string;
  module: ModuleKey | 'super_admin';
  action?: ActionKey;
};

const MODULE_ROUTE_RULES: RoutePermissionRule[] = [];

/** Register RBAC rules for future modules without redesigning the guard layer. */
export function registerRoutePermissionRule(rule: RoutePermissionRule) {
  MODULE_ROUTE_RULES.push(rule);
}

export function getRegisteredRouteRules() {
  return MODULE_ROUTE_RULES.slice();
}

export function resolveRegisteredRoutePermission(
  method: string,
  pathname: string,
): { module: ModuleKey | 'super_admin'; action: ActionKey } | null {
  const normalized = pathname.replace(/\/$/, '');
  const match = MODULE_ROUTE_RULES.find((rule) => {
    if (rule.method && rule.method !== method) return false;
    return normalized === rule.pathPrefix || normalized.startsWith(`${rule.pathPrefix}/`);
  });

  if (!match) return null;
  if (match.module === 'super_admin') {
    return { module: 'super_admin', action: methodToAction(method) };
  }

  return {
    module: match.module,
    action: match.action || methodToAction(method),
  };
}

registerRoutePermissionRule({
  pathPrefix: '/api/admin/rbac',
  module: 'super_admin',
});

registerRoutePermissionRule({
  pathPrefix: '/api/admin/blog',
  module: MODULES.BLOG,
});

registerRoutePermissionRule({
  pathPrefix: '/api/admin/quotation',
  module: MODULES.AI_QUOTES,
});

registerRoutePermissionRule({
  pathPrefix: '/api/admin/reviews',
  module: MODULES.REVIEWS,
});
