import OpsShell from '@/components/ops/OpsShell';
import RerentWorkspace from '@/components/ops/rerent/RerentWorkspace';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsRerentPage() {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Re-rent"
      subtitle="Lease expiries. Call and WhatsApp are taps on your phone. The server does not send them."
      pipelineStage="supply"
    >
      <RerentWorkspace />
    </OpsShell>
  );
}
