import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmQueue from '@/components/ops/broker-crm/BrokerCrmQueue';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsBrokerCrmQueuePage() {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="WhatsApp priority queue"
      subtitle="Waves for brokers in two or more groups. Approve logs the wave or exports a CSV. No message is sent."
      pipelineStage="demand"
    >
      <BrokerCrmQueue />
    </OpsShell>
  );
}
