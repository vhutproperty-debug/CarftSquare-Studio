import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmDetail from '@/components/ops/broker-crm/BrokerCrmDetail';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsBrokerCrmDetailPage({ params }: { params: { id: string } }) {
  bindBrokerCrmPageToSession();
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
