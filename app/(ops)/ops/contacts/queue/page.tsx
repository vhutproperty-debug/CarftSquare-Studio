import OpsShell from '@/components/ops/OpsShell';
import ColdCallWorkspace from '@/components/ops/contacts/ColdCallWorkspace';

export const dynamic = 'force-dynamic';

export default function OpsColdCallPage() {
  return (
    <OpsShell
      title="Cold calls"
      subtitle="Multi-unit owners first, then expiring agreements, then people who have not been contacted."
      pipelineStage="supply"
    >
      <ColdCallWorkspace />
    </OpsShell>
  );
}
