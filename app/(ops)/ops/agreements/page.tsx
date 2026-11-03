import OpsShell from '@/components/ops/OpsShell';
import AgreementWorkspace from '@/components/ops/agreements/AgreementWorkspace';
import AgreementTermsPanel from '@/components/ops/workspace/AgreementTermsPanel';

export default function OpsAgreementsPage() {
  return (
    <OpsShell
      title="Agreement Tracking"
      subtitle="Monitor agreement lifecycle, document completion, and expiry dates."
      pipelineStage="agreement"
    >
      <AgreementWorkspace />
      <AgreementTermsPanel />
    </OpsShell>
  );
}
