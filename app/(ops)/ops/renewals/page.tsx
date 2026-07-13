import OpsShell from '@/components/ops/OpsShell';
import RenewalWorkspace from '@/components/ops/renewals/RenewalWorkspace';

export default function OpsRenewalsPage() {
  return (
    <OpsShell
      title="Renewals"
      subtitle="Track upcoming renewals, due dates, and lapsed agreements."
      pipelineStage="renewal"
    >
      <RenewalWorkspace />
    </OpsShell>
  );
}
