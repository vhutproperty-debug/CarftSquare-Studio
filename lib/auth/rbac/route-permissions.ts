import { NextResponse } from 'next/server';
import { PERMISSIONS, type Permission } from '@/lib/auth/rbac/permissions';

/** Maps catch-all admin route segments to RBAC permissions. */
export function resolveCatchAllAdminPermission(
  method: string,
  segments: string[],
): Permission | 'super_admin' | null {
  const section = segments[1];
  const action = segments[2];

  if (!section) return null;

  if (section === 'rbac') return 'super_admin';

  if (section === 'about' || section === 'services' || section === 'rental-interiors') {
    return PERMISSIONS.PROJECTS;
  }

  if (section === 'gallery') {
    return PERMISSIONS.GALLERY;
  }

  if (section === 'seo' || section === 'media') {
    return PERMISSIONS.MARKETING;
  }

  if (section === 'leads' || section === 'vendors') {
    return PERMISSIONS.LEADS;
  }

  if (section === 'dashboard') {
    return PERMISSIONS.ANALYTICS;
  }

  if (section === 'pricing' || section === 'quote') {
    return PERMISSIONS.AI_QUOTES;
  }

  if (section === 'shades' || section === 'email' || section === 'whatsapp') {
    return PERMISSIONS.MARKETING;
  }

  if (section === 'visualizer') {
    return PERMISSIONS.MARKETING;
  }

  if (method === 'DELETE' && (section === 'services' || section === 'gallery')) {
    return section === 'gallery' ? PERMISSIONS.GALLERY : PERMISSIONS.PROJECTS;
  }

  if (method === 'PUT' && section === 'leads') return PERMISSIONS.LEADS;
  if (method === 'PUT' && section === 'vendors') return PERMISSIONS.LEADS;

  if (action === 'reorder' || action === 'categories') {
    return section === 'gallery' ? PERMISSIONS.GALLERY : PERMISSIONS.PROJECTS;
  }

  return null;
}

export function resolveLegacyRoutePermission(method: string, segments: string[]): Permission | null {
  if (segments[0] === 'leads') return PERMISSIONS.LEADS;
  if (segments[0] === 'dashboard') return PERMISSIONS.ANALYTICS;
  if (segments[0] === 'visualizer') return PERMISSIONS.MARKETING;
  if (method === 'PUT' && segments[0] === 'leads') return PERMISSIONS.LEADS;
  if (method === 'DELETE' && segments[0] === 'leads') return PERMISSIONS.LEADS;
  return null;
}

export const DEDICATED_ROUTE_PERMISSIONS: Record<string, Permission | 'super_admin'> = {
  '/api/admin/reviews': PERMISSIONS.REVIEWS,
  '/api/admin/quotation/leads': PERMISSIONS.AI_QUOTES,
  '/api/admin/quotation/pricing': PERMISSIONS.AI_QUOTES,
  '/api/admin/quotation/analytics': PERMISSIONS.ANALYTICS,
  '/api/admin/quotation/consultations': PERMISSIONS.CUSTOMERS,
  '/api/admin/quotation/designer-leads': PERMISSIONS.CUSTOMERS,
  '/api/admin/rbac/admins': 'super_admin',
  '/api/admin/rbac/activity-logs': 'super_admin',
};

export function resolveDedicatedRoutePermission(pathname: string): Permission | 'super_admin' | null {
  const normalized = pathname.replace(/\/$/, '');
  for (const [route, permission] of Object.entries(DEDICATED_ROUTE_PERMISSIONS)) {
    if (normalized === route || normalized.startsWith(`${route}/`)) {
      return permission;
    }
  }
  return null;
}
