import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import {
  enqueueBrokerImport,
  processEnqueuedImport,
} from '@/lib/ops/brokers/import/import-job';
import { publicOpsError } from '@/lib/ops/brokers/safe-error';
import { brokerImportMetaSchema } from '@/lib/ops/brokers/schemas';

/** Allow large WhatsApp exports on serverless platforms that honor this. */
export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireOpsEditAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const uploadStarted = Date.now();
  try {
    const form = await request.formData();
    const uploadMs = Date.now() - uploadStarted;

    const file = form.get('file');
    const groupNameRaw = form.get('groupName');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A WhatsApp .txt export file is required.' }, { status: 400 });
    }

    const resumeBatchIdRaw = form.get('resumeBatchId');
    const meta = brokerImportMetaSchema.safeParse({
      groupName: typeof groupNameRaw === 'string' ? groupNameRaw : '',
      resumeBatchId: typeof resumeBatchIdRaw === 'string' ? resumeBatchIdRaw : undefined,
    });
    if (!meta.success) {
      return NextResponse.json({ error: meta.error.flatten() }, { status: 400 });
    }

    const readStarted = Date.now();
    const content = await file.text();
    const fileReadMs = Date.now() - readStarted;

    const preloadTimings = { upload: uploadMs, fileRead: fileReadMs };

    const enqueued = await enqueueBrokerImport({
      fileName: file.name,
      mimeType: file.type,
      content,
      groupName: meta.data.groupName,
      uploadedBy: auth.admin.id,
      uploadedByEmail: auth.admin.email,
      resumeBatchId: meta.data.resumeBatchId,
      preloadTimings,
    });

    if (enqueued.mode === 'sync') {
      await logOpsActivity({
        action: 'broker_import_duplicate_skipped',
        actorId: auth.admin.id,
        actorEmail: auth.admin.email,
        resource: 'ops_broker_import_batches',
        details: {
          batchId: enqueued.summary.batch.id,
          groupName: enqueued.summary.batch.groupName,
          fileName: enqueued.summary.batch.fileName,
          alreadyProcessed: true,
          importStatus: enqueued.summary.batch.importStatus,
          stageTimings: enqueued.summary.stageTimings,
        },
        request,
      });
      return NextResponse.json(enqueued.summary, { status: 200 });
    }

    if (!enqueued.alreadyRunning) {
      waitUntil(
        processEnqueuedImport(enqueued.batchId, {
          actorId: auth.admin.id,
          actorEmail: auth.admin.email,
          preloadTimings,
        }).catch((error) => {
          console.error(
            '[ops-brokers] async_import_failed',
            error instanceof Error ? error.message : error,
          );
        }),
      );
    }

    await logOpsActivity({
      action: 'broker_import_accepted',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_import_batches',
      details: {
        batchId: enqueued.batchId,
        groupName: enqueued.batch.groupName,
        fileName: enqueued.batch.fileName,
        alreadyRunning: Boolean(enqueued.alreadyRunning),
        stageTimings: preloadTimings,
      },
      request,
    });

    return NextResponse.json(
      {
        async: true,
        batchId: enqueued.batchId,
        batch: enqueued.batch,
        alreadyRunning: Boolean(enqueued.alreadyRunning),
        stageTimings: preloadTimings,
        progress: enqueued.batch.progress,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('[ops-brokers] import_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: publicOpsError(error, 'Unable to process WhatsApp import.') },
      { status: 500 },
    );
  }
}
