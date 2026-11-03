import SiteVisitBoard from '@/components/ops/visits/SiteVisitBoard';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function SiteVisitsPage() {
  return (
    <OpsShell title="Site visits" subtitle="Schedule and complete visits without changing the deal pipeline." pipelineStage="deal" dense>
      <SiteVisitBoard />
    </OpsShell>
  );
}
