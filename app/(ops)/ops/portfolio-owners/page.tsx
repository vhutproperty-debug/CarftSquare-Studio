import OpsShell from '@/components/ops/OpsShell';
import PortfolioWorkspace from '@/components/ops/portfolio/PortfolioWorkspace';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsPortfolioOwnersPage() {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Portfolio owners"
      subtitle="People with two or more flats. Non-admin roles see a masked name and phone."
      pipelineStage="supply"
    >
      <PortfolioWorkspace />
    </OpsShell>
  );
}
