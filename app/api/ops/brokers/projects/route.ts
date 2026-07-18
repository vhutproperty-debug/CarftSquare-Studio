import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess, requireOpsViewAccess } from '@/lib/ops/auth';
import {
  createProjectAlias,
  listProjectAliases,
  listUnknownProjects,
} from '@/lib/ops/brokers/normalize/project-aliases';
import { publicOpsError } from '@/lib/ops/brokers/safe-error';
import { projectAliasCreateSchema } from '@/lib/ops/brokers/schemas';
import { getDatabase } from '@/lib/ops/brokers/store';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  try {
    const db = await getDatabase();
    const [aliases, unknownProjects] = await Promise.all([
      listProjectAliases(db, { activeOnly: false }),
      listUnknownProjects(db, 100),
    ]);
    return NextResponse.json({ aliases, unknownProjects });
  } catch (error) {
    console.error('[ops-brokers] projects_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load projects.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const body = await request.json().catch(() => null);
  const parsed = projectAliasCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const alias = await createProjectAlias(db, {
      canonicalProject: parsed.data.canonicalProject,
      aliases: parsed.data.aliases ?? [],
      city: parsed.data.city,
      locality: parsed.data.locality,
      builder: parsed.data.builder,
      active: parsed.data.active,
    });
    await logOpsActivity({
      action: 'broker_project_alias_mutated',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_project_aliases',
      resourceId: alias.id,
      details: { op: 'create', canonicalProject: alias.canonicalProject },
      request,
    });
    return NextResponse.json({ alias }, { status: 201 });
  } catch (error) {
    console.error('[ops-brokers] project_create_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: publicOpsError(error, 'Unable to create project alias.') },
      { status: 500 },
    );
  }
}
