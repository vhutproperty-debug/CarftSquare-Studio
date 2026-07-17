import OpsShell from '@/components/ops/OpsShell';
import HousingIntegrationPanel from '@/components/ops/integrations/HousingIntegrationPanel';

export default function HousingIntegrationPage() {
  return (
    <OpsShell
      title="Housing.com"
      subtitle="Read-only connector — sync portal leads into the Demand workspace."
      pipelineStage="demand"
      dense
    >
      <HousingIntegrationPanel />
    </OpsShell>
  );
}
