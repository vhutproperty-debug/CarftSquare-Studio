import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { isSuperAdmin } from '@/lib/auth/rbac/roles';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import {
  activateGrowthCampaign,
  createGrowthProposal,
  createPausedGrowthCampaign,
  getGrowthDb,
  listApprovedCampaignInventory,
  listGrowthCampaigns,
  reviewGrowthCampaign,
  type PausedPublishResult,
} from '@/lib/ops/growth/campaign-studio/store';
import { metaCreateGate } from '@/lib/ops/growth/campaign-studio/proposal';
import { publishPausedLeadCampaign } from '@/lib/meta-ads/publish-paused';
import { updateMetaObjectStatus } from '@/lib/meta-ads/controls';
import { getMetaAdsReadiness } from '@/lib/meta-ads/readiness';
import type { MetaAdsCampaignRecord, MetaAdsCreative } from '@/lib/meta-ads/types';
import { forbidBrokerGrowth, forbidUnlessGrowth } from '@/lib/ops/os/guard';

export const dynamic = 'force-dynamic';

async function readinessOrClosed() {
  try {
    return await getMetaAdsReadiness();
  } catch (error) {
    return {
      canPublishPaused: false,
      permissions: [] as string[],
      blockers: [error instanceof Error ? error.message : 'Meta permissions are not available.'],
      activeSpendAllowed: false,
    };
  }
}

export async function GET(request: Request) {
  const closed = forbidUnlessGrowth('CAMPAIGN_STUDIO');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const db = await getGrowthDb();
  const readiness = await readinessOrClosed();
  const [inventory, campaigns] = await Promise.all([
    listApprovedCampaignInventory(db),
    listGrowthCampaigns(db),
  ]);
  return NextResponse.json({
    inventory,
    campaigns,
    gate: metaCreateGate(readiness),
    activeSpendAllowed: readiness.activeSpendAllowed,
    canReview: isSuperAdmin(auth.admin),
  });
}

export async function POST(request: Request) {
  const closed = forbidUnlessGrowth('CAMPAIGN_STUDIO');
  if (closed) return closed;
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  const broker = forbidBrokerGrowth(auth.admin);
  if (broker) return broker;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Campaign payload is required.' }, { status: 400 });
  const db = await getGrowthDb();
  const actor = { id: auth.admin.id, email: auth.admin.email };
  const superAdmin = isSuperAdmin(auth.admin);
  try {
    if (body.action === 'generate') {
      const campaign = await createGrowthProposal(db, String(body.inventoryId || ''), auth.admin.id);
      return NextResponse.json({ campaign }, { status: 201 });
    }
    if (body.action === 'approve' || body.action === 'reject') {
      const campaign = await reviewGrowthCampaign(db, String(body.id || ''), {
        decision: body.action,
        approvedBudgetInr: body.approvedBudgetInr == null ? null : Number(body.approvedBudgetInr),
        isSuperAdmin: superAdmin,
      }, actor);
      return NextResponse.json({ campaign });
    }
    if (body.action === 'create_paused') {
      const readiness = await readinessOrClosed();
      const gate = metaCreateGate(readiness);
      const campaign = await createPausedGrowthCampaign(db, String(body.id || ''), {
        isSuperAdmin: superAdmin,
        permissionsAvailable: gate.available,
        publish: async (input): Promise<PausedPublishResult> => {
          const creative: MetaAdsCreative = {
            id: String(body.id || 'growth'),
            offer: input.copy.description,
            audienceHint: input.areas.join(', '),
            areas: input.areas,
            primaryText: input.copy.primaryText,
            headline: input.copy.headline,
            description: input.copy.description,
            cta: input.copy.cta,
            angle: 'growth_studio',
            status: 'approved',
            createdBy: auth.admin.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const record: MetaAdsCampaignRecord = {
            id: String(body.id || 'growth'),
            name: input.name,
            creativeId: creative.id,
            objective: 'OUTCOME_LEADS',
            destination: 'instant_form',
            dailyBudgetInr: input.dailyBudgetInr,
            status: 'ready',
            metaStatus: 'PAUSED',
            dryRun: true,
            areas: input.areas,
            createdBy: auth.admin.id,
            createdAt: creative.createdAt,
            updatedAt: creative.updatedAt,
          };
          const result = await publishPausedLeadCampaign({ campaign: record, creative });
          return {
            ok: result.ok,
            metaCampaignId: result.metaCampaignId,
            metaAdSetId: result.metaAdSetId,
            metaAdId: result.metaAdId,
            error: result.error,
          };
        },
      }, actor);
      if (campaign.status !== 'paused_on_meta') {
        return NextResponse.json({ campaign, created: false, error: campaign.lastError || gate.message }, { status: gate.available ? 502 : 409 });
      }
      return NextResponse.json({ campaign, created: true, metaStatus: 'PAUSED' });
    }
    if (body.action === 'activate') {
      const readiness = await readinessOrClosed();
      const gate = metaCreateGate(readiness);
      const campaign = await activateGrowthCampaign(db, String(body.id || ''), {
        isSuperAdmin: superAdmin,
        confirm: String(body.confirm || ''),
        permissionsAvailable: gate.available,
        activeSpendAllowed: readiness.activeSpendAllowed,
        activate: async ({ objectId }) => {
          await updateMetaObjectStatus({ objectId, status: 'ACTIVE', allowActive: true });
        },
      }, actor);
      if (campaign.status !== 'active') {
        return NextResponse.json({ campaign, activated: false, error: campaign.lastError }, { status: 409 });
      }
      return NextResponse.json({ campaign, activated: true });
    }
    return NextResponse.json({ error: 'Unknown campaign action.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update the campaign.';
    const status = /permission|super admin|ACTIVATE|stays paused|stays approved|not available/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
