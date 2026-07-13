import OpsShell from '@/components/ops/OpsShell';
import CallsWorkspace from '@/components/ops/calls/CallsWorkspace';

export default function OpsCallsPage() {
  return (
    <OpsShell
      title="Supply Workspace"
      subtitle="Cold calling and outreach to build company-owned Mumbai inventory."
      workspace
      pipelineStage="supply"
    >
      <CallsWorkspace />
    </OpsShell>
  );
}
