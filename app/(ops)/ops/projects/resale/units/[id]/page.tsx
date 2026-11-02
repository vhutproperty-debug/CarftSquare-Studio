import OpsShell from '@/components/ops/OpsShell';
import ResaleUnitDetail from '@/components/ops/projects/ResaleUnitDetail';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsResaleUnitPage({ params }: { params: { id: string } }) {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Resale unit"
      subtitle="One flat or rental. Owner contact and the flat number are admin-only."
      pipelineStage="supply"
    >
      <ResaleUnitDetail unitId={params.id} />
    </OpsShell>
  );
}
