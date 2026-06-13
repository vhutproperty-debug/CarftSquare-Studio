import type { Db } from 'mongodb';
import { writeAuditLog } from '@/lib/auth/rbac/store';
import type { AuditAction } from '@/lib/auth/rbac/types';
import type { ModuleKey } from '@/lib/auth/rbac/modules';

type AuditContext = {
  request?: Request;
  actorId: string;
  actorEmail: string;
};

function getRequestMeta(request?: Request) {
  if (!request) return { ip: undefined, userAgent: undefined };
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

export async function logAuditEvent(
  db: Db,
  action: AuditAction,
  context: AuditContext,
  resource: string,
  options: {
    module?: ModuleKey | 'auth' | 'admin' | 'system';
    resourceId?: string;
    details?: Record<string, unknown>;
  } = {},
) {
  const meta = getRequestMeta(context.request);
  return writeAuditLog(db, {
    actorId: context.actorId,
    actorEmail: context.actorEmail,
    action,
    module: options.module || inferModuleFromResource(resource),
    resource,
    resourceId: options.resourceId,
    details: options.details,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

function inferModuleFromResource(resource: string): ModuleKey | 'auth' | 'admin' | 'system' {
  if (resource === 'admin') return 'admin';
  if (resource === 'auth' || resource === 'session') return 'auth';
  return resource as ModuleKey;
}
