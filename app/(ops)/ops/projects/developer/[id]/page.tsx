import OpsShell from '@/components/ops/OpsShell';
import DeveloperProjectDetail from '@/components/ops/projects/DeveloperProjectDetail';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsDeveloperProjectPage({ params }: { params: { id: string } }) {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Developer project"
      subtitle="Primary inventory. Contacts on this page are for the ops team."
      pipelineStage="supply"
    >
      <DeveloperProjectDetail projectId={params.id} />
    </OpsShell>
  );
}
