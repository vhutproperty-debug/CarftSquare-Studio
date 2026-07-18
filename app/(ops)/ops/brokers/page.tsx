import OpsShell from '@/components/ops/OpsShell';
import BrokersWorkspace from '@/components/ops/brokers/BrokersWorkspace';

export default function OpsBrokersPage() {
  return (
    <OpsShell
      title="Broker Inventory"
      subtitle="WhatsApp broker-group exports → structured, searchable, fresh inventory with full source provenance."
      pipelineStage="supply"
    >
      <BrokersWorkspace />
    </OpsShell>
  );
}
