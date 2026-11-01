import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmQueue from '@/components/ops/broker-crm/BrokerCrmQueue';

export const dynamic = 'force-dynamic';

export default function OpsBrokerCrmQueuePage() {
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
