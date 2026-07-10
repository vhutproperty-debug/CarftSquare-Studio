import OpsShell from '@/components/ops/OpsShell';
import CallsWorkspace from '@/components/ops/calls/CallsWorkspace';

export default function OpsCallsPage() {
  return (
    <OpsShell
      title="Calls Workspace"
      subtitle="Daily calling queue for incoming leads and cold-call prospects."
    >
      <CallsWorkspace />
    </OpsShell>
  );
}
