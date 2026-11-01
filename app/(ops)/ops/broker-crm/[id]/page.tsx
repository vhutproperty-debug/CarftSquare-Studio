import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmDetail from '@/components/ops/broker-crm/BrokerCrmDetail';

export const dynamic = 'force-dynamic';

export default function OpsBrokerCrmDetailPage({ params }: { params: { id: string } }) {
  return (
    <OpsShell
      title="Broker"
      subtitle="Tags, status, notes, and requirements. Requirements feed Market. Nothing here sends WhatsApp."
      pipelineStage="demand"
    >
      <BrokerCrmDetail brokerId={params.id} backHref="/ops/broker-crm" />
    </OpsShell>
  );
}
