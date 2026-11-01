import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import {
  commitProspectImport,
  parseProspectImportDocument,
  planProspectImport,
} from '@/lib/ops/calls/import-prospects';
import { getDatabase, listProspects } from '@/lib/ops/calls/prospect-store';

export const runtime = 'nodejs';

const MAX_BYTES = 2_000_000;

function isOpsAdmin(role?: string): boolean {
  return role === 'admin' || role === 'super_admin';
}

async function readImportPayload(request: Request): Promise<{
  rows: unknown[];
  dryRun: boolean;
  filename?: string;
}> {
  const url = new URL(request.url);
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw Object.assign(new Error('A CSV or JSON file is required.'), { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      throw Object.assign(new Error('Import file must be 2 MB or smaller.'), { status: 413 });
    }
    const dryRunRaw = form.get('dryRun');
    const dryRun = dryRunRaw == null
      ? url.searchParams.get('dryRun') !== 'false'
      : String(dryRunRaw) !== 'false';
    const text = await file.text();
    return {
      rows: parseProspectImportDocument(text, file.name),
      dryRun,
      filename: file.name,
    };
  }

  const body = await request.json();
  const dryRun = body && typeof body === 'object' && !Array.isArray(body)
    ? body.dryRun !== false && url.searchParams.get('dryRun') !== 'false'
    : url.searchParams.get('dryRun') !== 'false';
  if (Array.isArray(body)) {
    return { rows: body, dryRun };
  }
  if (body && typeof body === 'object' && Array.isArray(body.rows)) {
    return { rows: body.rows, dryRun: body.dryRun !== false && url.searchParams.get('dryRun') !== 'false' };
  }
  throw Object.assign(new Error('JSON body must be { rows, dryRun } or an array of prospects.'), { status: 400 });
}

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  if (!auth.ok) return authResultToResponse(auth);
  if (!isOpsAdmin(auth.admin.role)) {
    return NextResponse.json({ error: 'Owner import is limited to ops admins.' }, { status: 403 });
  }

  try {
    const { rows, dryRun, filename } = await readImportPayload(request);
    const db = await getDatabase();
    const existing = await listProspects(db, { isAdminViewAll: true, limit: 5000 });
    if (dryRun) {
      const { plan } = planProspectImport(rows, existing);
      return NextResponse.json({ dryRun: true, filename, ...plan });
    }

    const plan = await commitProspectImport(db, rows, existing, auth.admin.id);
    await logOpsActivity({
      action: 'import_prospects',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_prospects',
      details: {
        filename,
        creates: plan.summary.creates,
        updates: plan.summary.updates,
        skips: plan.summary.skips,
      },
      request,
    });
    return NextResponse.json({ dryRun: false, filename, ...plan });
  } catch (error) {
    const status = (error as { status?: number }).status || 500;
    if (status >= 500) {
      console.error('[ops-prospects] import_failed', error instanceof Error ? error.message : error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to import prospects.' },
      { status },
    );
  }
}
