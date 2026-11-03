import OpsDashboardPanel from '@/components/ops/OpsDashboardPanel';
import OpsShell from '@/components/ops/OpsShell';
import WorkspaceSummaryStrip from '@/components/ops/workspace/WorkspaceSummaryStrip';

export default function OpsDashboardPage() {
  return (
    <OpsShell
      title="Dashboard"
      subtitle="Brokerage operations overview — demand, supply, and pipeline readiness."
      dense
    >
      <WorkspaceSummaryStrip />
      <OpsDashboardPanel />
    </OpsShell>
  );
}
