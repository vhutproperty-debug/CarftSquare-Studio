import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmWorkspace from '@/components/ops/broker-crm/BrokerCrmWorkspace';

export const dynamic = 'force-dynamic';

export default function OpsBrokerCrmPage() {
  return (
    <OpsShell
      title="Broker CRM"
      subtitle="WhatsApp-group brokers on the demand side. Priority floats admins and people in more than one group. Outreach export skips do-not-contact."
      pipelineStage="demand"
    >
      <BrokerCrmWorkspace />
    </OpsShell>
  );
}
