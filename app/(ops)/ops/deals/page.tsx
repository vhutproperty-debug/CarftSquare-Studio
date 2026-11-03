import OpsShell from '@/components/ops/OpsShell';
import DealWorkspace from '@/components/ops/deals/DealWorkspace';

export default function OpsDealsPage() {
  return (
    <OpsShell
      title="Deal Workspace"
      subtitle="Manage brokerage transactions from accepted match through commission collection."
      pipelineStage="deal"
    >
      <DealWorkspace />
      <p className="mt-4 text-sm">
        <a className="font-semibold text-orange-700" href="/ops/site-visits">Open site visits</a>
      </p>
    </OpsShell>
  );
}
