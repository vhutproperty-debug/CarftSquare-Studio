import CampaignStudioDesk from '@/components/ops/growth/CampaignStudioDesk';
import OpsShell from '@/components/ops/OpsShell';
import { growthModuleEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default function CampaignStudioPage() {
  if (!growthModuleEnabled('CAMPAIGN_STUDIO')) {
    return (
      <OpsShell title="Campaign Studio" subtitle="Growth module" dense>
        <p className="text-sm text-slate-600">Campaign Studio is off. Set CSOS_P7_CAMPAIGN_STUDIO=1 to turn it on.</p>
      </OpsShell>
    );
  }
  return (
    <OpsShell title="Campaign Studio" subtitle="Template proposals stay paused until a super admin activates them." pipelineStage="demand" dense>
      <CampaignStudioDesk />
    </OpsShell>
  );
}
