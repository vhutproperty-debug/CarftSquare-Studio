import OpsShell from '@/components/ops/OpsShell';
import LeadInbox from '@/components/ops/leads/LeadInbox';

export default function OpsLeadsPage() {
  return (
    <OpsShell
      title="Demand Operations Workspace"
      subtitle="Process Mumbai residential enquiries — qualify, assign, and advance to matching."
      pipelineStage="demand"
    >
      <LeadInbox />
    </OpsShell>
  );
}
