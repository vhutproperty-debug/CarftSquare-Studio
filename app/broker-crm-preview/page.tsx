import { notFound } from 'next/navigation';
import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmWorkspace from '@/components/ops/broker-crm/BrokerCrmWorkspace';
import { sampleBrokerCrmRecords } from '@/lib/ops/broker-crm/sample';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function BrokerCrmPreviewPage() {
  if (process.env.BROKER_CRM_SAMPLE_PREVIEW !== '1') notFound();
  return (
    <OpsShell
      title="Broker CRM"
      subtitle="Sample directory for review. These are not real broker numbers."
      pipelineStage="demand"
    >
      <BrokerCrmWorkspace initialRecords={sampleBrokerCrmRecords()} base="/broker-crm-preview" />
    </OpsShell>
  );
}
