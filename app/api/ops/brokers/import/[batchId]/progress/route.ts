import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { getImportJobProgress } from '@/lib/ops/brokers/import/import-job';
import { publicOpsError } from '@/lib/ops/brokers/safe-error';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: { batchId: string } },
) {
  const auth = await requireOpsViewAccess(request);
  if (auth.ok === false) {
    console.warn(
      '[ops-brokers] import_progress_auth_denied',
      JSON.stringify({
        userId: null,
        role: null,
        reason: auth.message,
        status: auth.status,
        batchId: context.params.batchId,
      }),
    );
    return authResultToResponse(auth);
  }

  try {
    const batchId = context.params.batchId;
    if (!batchId) {
      return NextResponse.json({ error: 'batchId is required.' }, { status: 400 });
    }

    const progress = await getImportJobProgress(batchId);
    if (!progress) {
      return NextResponse.json({ error: 'Import batch not found.' }, { status: 404 });
    }

    return NextResponse.json({
      batchId,
      done: progress.done,
      importStatus: progress.batch.importStatus,
      stage: progress.batch.stage,
      progress: progress.batch.progress,
      stageTimings: progress.batch.stageTimings,
      summary: progress.summary,
      batch: progress.batch,
    });
  } catch (error) {
    console.error('[ops-brokers] import_progress_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: publicOpsError(error, 'Unable to load import progress.') },
      { status: 500 },
    );
  }
}
