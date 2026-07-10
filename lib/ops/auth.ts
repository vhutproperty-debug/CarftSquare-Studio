import { authorizeRequest } from '@/lib/auth/require-admin-api';
import type { AuthResult } from '@/lib/auth/rbac/guard';
import { OPS_MODULE } from '@/lib/ops/permissions';

export async function requireOpsViewAccess(request: Request): Promise<AuthResult> {
  return authorizeRequest(request, { permission: OPS_MODULE, action: 'view' });
}

export async function requireOpsEditAccess(request: Request): Promise<AuthResult> {
  return authorizeRequest(request, { permission: OPS_MODULE, action: 'edit' });
}
