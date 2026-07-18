import { authorizeRequest } from '@/lib/auth/require-admin-api';
import type { AuthResult } from '@/lib/auth/rbac/guard';
import { RESEARCH_MODULE } from '@/lib/research/permissions';

export async function requireResearchViewAccess(request: Request): Promise<AuthResult> {
  return authorizeRequest(request, { permission: RESEARCH_MODULE, action: 'view' });
}

export async function requireResearchEditAccess(request: Request): Promise<AuthResult> {
  return authorizeRequest(request, { permission: RESEARCH_MODULE, action: 'edit' });
}
