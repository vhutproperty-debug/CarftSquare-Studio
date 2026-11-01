import { notFound } from 'next/navigation';
import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmQueue from '@/components/ops/broker-crm/BrokerCrmQueue';
import { sampleBrokerCrmRecords } from '@/lib/ops/broker-crm/sample';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function BrokerCrmPreviewQueuePage() {
  if (process.env.BROKER_CRM_SAMPLE_PREVIEW !== '1') notFound();
  return (
    <OpsShell
      title="WhatsApp priority queue"
      subtitle="Sample waves. Approving or exporting does not send WhatsApp."
      pipelineStage="demand"
    >
      <BrokerCrmQueue
        initialRecords={sampleBrokerCrmRecords()}
        detailBase="/broker-crm-preview"
        tabsBase="/broker-crm-preview"
      />
    </OpsShell>
  );
}
