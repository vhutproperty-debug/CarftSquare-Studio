import { waitUntil } from '@vercel/functions';
import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { getSessionTokenFromRequest, SESSION_COOKIE } from '@/lib/auth/session-constants';
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

function cookieNamesFromRequest(request: Request): string[] {
  const header = request.headers.get('cookie') || '';
  return header
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean);
}

export async function POST(request: Request) {
  // Identical auth path as other /api/ops mutate routes (e.g. housing sync / freshness).
  const auth = await requireOpsEditAccess(request);
  if (auth.ok === false) {
    console.warn(
      '[ops-brokers] import_auth_denied',
      JSON.stringify({
        userId: null,
        role: null,
        reason: auth.message,
        status: auth.status,
        hasSessionCookieName: cookieNamesFromRequest(request).includes(SESSION_COOKIE),
        hasSessionToken: Boolean(getSessionTokenFromRequest(request)),
        cookieNames: cookieNamesFromRequest(request),
      }),
    );
    return authResultToResponse(auth);
  }

  console.info(
    '[ops-brokers] import_auth_ok',
    JSON.stringify({
      userId: auth.admin.id,
      role: auth.admin.role,
      reason: null,
    }),
  );

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
