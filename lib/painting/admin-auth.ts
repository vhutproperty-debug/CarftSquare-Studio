import type { ActionKey } from '@/lib/auth/rbac/actions';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import type { AuthResult } from '@/lib/auth/rbac/guard';
import { MODULES } from '@/lib/auth/rbac/modules';

/** Painting leads CRM — accessible to Painting module or general Leads managers. */
export async function authorizePaintingLeadsRequest(
  request: Request,
  action: ActionKey = 'view',
): Promise<AuthResult> {
  const paintingAuth = await authorizeRequest(request, { permission: MODULES.PAINTING, action });
  if (paintingAuth.ok) return paintingAuth;

  return authorizeRequest(request, { permission: MODULES.LEADS, action });
}

/** Gallery/testimonials — Painting module only. */
export async function authorizePaintingContentRequest(
  request: Request,
  action: ActionKey = 'view',
): Promise<AuthResult> {
  return authorizeRequest(request, { permission: MODULES.PAINTING, action });
}
