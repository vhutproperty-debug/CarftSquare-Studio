import { notFound } from 'next/navigation';
import OpsShell from '@/components/ops/OpsShell';
import BrokerCrmDetail from '@/components/ops/broker-crm/BrokerCrmDetail';
import { sampleBrokerCrmRecords } from '@/lib/ops/broker-crm/sample';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function BrokerCrmPreviewDetailPage({ params }: { params: { id: string } }) {
  if (process.env.BROKER_CRM_SAMPLE_PREVIEW !== '1') notFound();
  const broker = sampleBrokerCrmRecords().find((record) => record.id === params.id);
  if (!broker) notFound();
  return (
    <OpsShell
      title={broker.name}
      subtitle="Sample broker detail. Invented phone number."
      pipelineStage="demand"
    >
      <BrokerCrmDetail initial={broker} backHref="/broker-crm-preview" />
    </OpsShell>
  );
}
