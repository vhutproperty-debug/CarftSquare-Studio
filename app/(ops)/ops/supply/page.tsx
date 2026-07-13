import OpsShell from '@/components/ops/OpsShell';
import SupplyWorkspace from '@/components/ops/supply/SupplyWorkspace';

export default function OpsSupplyPage() {
  return (
    <OpsShell
      title="Supply Workspace"
      subtitle="Manage brokerage inventory — rentals, sales, exclusives, and owner listings ready for matching."
      pipelineStage="supply"
    >
      <SupplyWorkspace />
    </OpsShell>
  );
}
