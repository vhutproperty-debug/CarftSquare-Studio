import OpsShell from '@/components/ops/OpsShell';
import AgreementWorkspace from '@/components/ops/agreements/AgreementWorkspace';

export default function OpsAgreementsPage() {
  return (
    <OpsShell
      title="Agreement Tracking"
      subtitle="Monitor agreement lifecycle, document completion, and expiry dates."
      pipelineStage="agreement"
    >
      <AgreementWorkspace />
    </OpsShell>
  );
}
