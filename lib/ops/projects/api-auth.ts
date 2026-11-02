import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { canManageProjects, canSeeResalePrivate } from '@/lib/ops/projects/access';

export type ProjectActor = {
  id: string;
  email: string;
  name: string;
  via: 'session' | 'token';
};

export type ProjectAuth =
  | { ok: true; actor: ProjectActor; canManage: boolean; canSeeSensitive: boolean }
  | { ok: false; response: Response };

const TOKEN_ACTOR: ProjectActor = {
  id: 'ops-api-token',
  email: 'ops-api-token',
  name: 'OPS API',
  via: 'token',
};

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

export function opsApiTokenMatches(request: Request): boolean {
  const expected = process.env.OPS_API_TOKEN?.trim();
  const given = bearerToken(request);
  if (!expected || !given) return false;
  const actual = createHash('sha256').update(given).digest();
  const wanted = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actual, wanted);
}

function actorFromSession(admin: { id: string; email: string; name?: string }): ProjectActor {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name || admin.email,
    via: 'session',
  };
}

export async function authorizeProjectRead(request: Request): Promise<ProjectAuth> {
  const auth = await requireOpsViewAccess(request);
  if (!auth.ok) {
    return { ok: false, response: authResultToResponse(auth) || NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 }) };
  }
  return {
    ok: true,
    actor: actorFromSession(auth.admin),
    canManage: canManageProjects(auth.admin),
    canSeeSensitive: canSeeResalePrivate(auth.admin),
  };
}

/**
 * Session admins use the same ops cookie as the rest of /ops.
 * An assistant with no cookie can POST/PATCH with Authorization: Bearer OPS_API_TOKEN.
 * A bearer header is never accepted as a fallback when the token is wrong.
 */
export async function authorizeProjectWrite(request: Request): Promise<ProjectAuth> {
  if (bearerToken(request)) {
    if (!process.env.OPS_API_TOKEN?.trim()) {
      return { ok: false, response: NextResponse.json({ error: 'OPS API token is not configured.' }, { status: 401 }) };
    }
    if (!opsApiTokenMatches(request)) {
      return { ok: false, response: NextResponse.json({ error: 'Invalid OPS API token.' }, { status: 401 }) };
    }
    return { ok: true, actor: TOKEN_ACTOR, canManage: true, canSeeSensitive: true };
  }
  const auth = await authorizeProjectRead(request);
  if (!auth.ok) return auth;
  if (!auth.canManage) {
    return { ok: false, response: NextResponse.json({ error: 'Admin access is required to edit projects.' }, { status: 403 }) };
  }
  return auth;
}

export function actorLabel(actor: ProjectActor): string {
  return actor.via === 'token' ? 'ops-api-token' : actor.email;
}

export function deniedProjectAuth(auth: ProjectAuth): auth is Extract<ProjectAuth, { ok: false }> {
  return auth.ok === false;
}
