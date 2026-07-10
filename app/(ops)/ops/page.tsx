import OpsDashboardPanel from '@/components/ops/OpsDashboardPanel';
import OpsShell from '@/components/ops/OpsShell';

export default function OpsDashboardPage() {
  return (
    <OpsShell
      title="Operations Dashboard"
      subtitle="Unified read-only view across live CraftSquare lead sources."
    >
      <OpsDashboardPanel />
    </OpsShell>
  );
}
