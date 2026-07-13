import OpsDashboardPanel from '@/components/ops/OpsDashboardPanel';
import OpsShell from '@/components/ops/OpsShell';

export default function OpsDashboardPage() {
  return (
    <OpsShell
      title="Brokerage Operations Overview"
      subtitle="Mumbai real estate — demand intake, supply generation, and pipeline readiness."
    >
      <OpsDashboardPanel />
    </OpsShell>
  );
}
