import OpsShell from '@/components/ops/OpsShell';
import ResaleInventory from '@/components/ops/projects/ResaleInventory';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsResaleProjectsPage() {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Projects"
      subtitle="Resale and rental units owned by individuals. Flat numbers and owner contacts are limited to admin roles."
      pipelineStage="supply"
    >
      <ResaleInventory />
    </OpsShell>
  );
}
