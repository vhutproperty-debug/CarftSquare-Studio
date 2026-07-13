import OpsShell from '@/components/ops/OpsShell';
import RevenueWorkspace from '@/components/ops/revenue/RevenueWorkspace';

export default function OpsRevenuePage() {
  return (
    <OpsShell
      title="Revenue Workspace"
      subtitle="Track expected brokerage, invoicing, collections, and overdue commissions."
      pipelineStage="revenue"
    >
      <RevenueWorkspace />
    </OpsShell>
  );
}
