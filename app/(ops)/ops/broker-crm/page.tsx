import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmWorkspace from '@/components/ops/broker-crm/BrokerCrmWorkspace';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsBrokerCrmPage() {
  bindBrokerCrmPageToSession();
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
