import OpsShell from '@/components/ops/OpsShell';
import DeveloperProjectList from '@/components/ops/projects/DeveloperProjectList';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsDeveloperProjectsPage() {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Projects"
      subtitle="Developer launches and under-construction inventory. Direct deals, channel-partner status, and sales contacts stay inside ops."
      pipelineStage="supply"
    >
      <DeveloperProjectList />
    </OpsShell>
  );
}
