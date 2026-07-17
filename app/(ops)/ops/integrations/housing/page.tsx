import OpsShell from '@/components/ops/OpsShell';
import HousingIntegrationPanel from '@/components/ops/integrations/HousingIntegrationPanel';

export default function HousingIntegrationPage() {
  return (
    <OpsShell
      title="Housing.com Integration"
      subtitle="Read-only connector — fetch, normalize, dedupe, and feed the unified demand pipeline."
      pipelineStage="demand"
    >
      <HousingIntegrationPanel />
    </OpsShell>
  );
}
