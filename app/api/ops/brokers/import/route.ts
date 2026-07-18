import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { logOpsActivity } from '@/lib/ops/activity/store';
import { requireOpsEditAccess } from '@/lib/ops/auth';
import { importWhatsAppBrokerExport } from '@/lib/ops/brokers/import/import-service';
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

  try {
    const form = await request.formData();
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

    const content = await file.text();
    const summary = await importWhatsAppBrokerExport({
      fileName: file.name,
      mimeType: file.type,
      content,
      groupName: meta.data.groupName,
      uploadedBy: auth.admin.id,
      uploadedByEmail: auth.admin.email,
      resumeBatchId: meta.data.resumeBatchId,
    });

    await logOpsActivity({
      action: summary.alreadyProcessed ? 'broker_import_duplicate_skipped' : 'broker_import_completed',
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
      resource: 'ops_broker_import_batches',
      details: {
        batchId: summary.batch.id,
        groupName: summary.batch.groupName,
        fileName: summary.batch.fileName,
        messagesParsed: summary.messagesParsed,
        createdListings: summary.createdListings,
        updatedListings: summary.updatedListings,
        alreadyProcessed: summary.alreadyProcessed,
        importStatus: summary.batch.importStatus,
      },
      request,
    });

    return NextResponse.json(summary, { status: summary.alreadyProcessed ? 200 : 201 });
  } catch (error) {
    console.error('[ops-brokers] import_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: publicOpsError(error, 'Unable to process WhatsApp import.') },
      { status: 500 },
    );
  }
}
