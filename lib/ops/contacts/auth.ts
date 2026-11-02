import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import {
  contactCapabilities,
  type ContactActor,
  type ContactCapabilities,
} from '@/lib/ops/permissions';
import { bearerToken, opsApiTokenMatches } from '@/lib/ops/projects/api-auth';

export type ContactAuth =
  | { ok: true; actor: ContactActor; capabilities: ContactCapabilities }
  | { ok: false; response: Response };

export function deniedContactAuth(auth: ContactAuth): auth is Extract<ContactAuth, { ok: false }> {
  return auth.ok === false;
}

const TOKEN_ACTOR: ContactActor = {
  id: 'ops-api-token',
  email: 'ops-api-token',
  name: 'OPS API',
  role: 'token',
  via: 'token',
};

export async function authorizeContacts(request: Request, mode: 'view' | 'token_or_manage' = 'view'): Promise<ContactAuth> {
  if (mode === 'token_or_manage' && bearerToken(request)) {
    if (!process.env.OPS_API_TOKEN?.trim()) {
      return { ok: false, response: NextResponse.json({ error: 'OPS API token is not configured.' }, { status: 401 }) };
    }
    if (!opsApiTokenMatches(request)) {
      return { ok: false, response: NextResponse.json({ error: 'Invalid OPS API token.' }, { status: 401 }) };
    }
    return { ok: true, actor: TOKEN_ACTOR, capabilities: contactCapabilities(TOKEN_ACTOR) };
  }

  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return {
      ok: false,
      response: authResultToResponse(auth) || NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 }),
    };
  }
  const actor: ContactActor = {
    id: auth.admin.id,
    email: auth.admin.email,
    name: auth.admin.name || auth.admin.email,
    role: auth.admin.role,
    via: 'session',
    status: auth.admin.status,
  };
  return { ok: true, actor, capabilities: contactCapabilities(actor) };
}

export function manageDenied(capabilities: ContactCapabilities, action: 'import' | 'export' | 'edit' | 'delete'): Response | null {
  const allowed = action === 'import'
    ? capabilities.importData
    : action === 'export'
      ? capabilities.exportData
      : action === 'delete'
        ? capabilities.deleteData
        : capabilities.editExisting;
  if (allowed) return null;
  const verb = action === 'import'
    ? 'import or upload contacts'
    : action === 'export'
      ? 'export or download contacts'
      : action === 'delete'
        ? 'delete contacts'
        : 'edit or delete existing contact data';
  return NextResponse.json({ error: `Only a super admin can ${verb}.` }, { status: 403 });
}
