import OpsShell from '@/components/ops/OpsShell';
import ResaleProjectDetail from '@/components/ops/projects/ResaleProjectDetail';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsResaleProjectPage({ params }: { params: { id: string } }) {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Resale project"
      subtitle="A project grouping for individual resale and rental units."
      pipelineStage="supply"
    >
      <ResaleProjectDetail projectId={params.id} />
    </OpsShell>
  );
}
