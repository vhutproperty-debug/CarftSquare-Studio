import { methodToAction } from '@/lib/auth/rbac/actions';
import { authorizeRequest } from '@/lib/auth/require-admin-api';

export async function guardAdmin(request, permission) {
  const action = methodToAction(request.method);
  const auth = await authorizeRequest(request, permission ? { permission, action } : {});
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      message: auth.message,
      admin: null,
    };
  }
  return { ok: true, admin: auth.admin };
}

export function authFailureJson(json, request, authResult) {
  return json({ error: authResult.message }, authResult.status, request);
}
