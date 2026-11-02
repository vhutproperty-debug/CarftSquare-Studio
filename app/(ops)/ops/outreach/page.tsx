import OpsShell from '@/components/ops/OpsShell';
import OutreachWorkspace from '@/components/ops/outreach/OutreachWorkspace';
import { bindBrokerCrmPageToSession } from '@/lib/ops/broker-crm/page-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function OpsOutreachPage() {
  bindBrokerCrmPageToSession();
  return (
    <OpsShell
      title="Owner & tenant outreach"
      subtitle="Manual WhatsApp only. Approving a wave records the decision and does not send messages."
      pipelineStage="demand"
    >
      <OutreachWorkspace />
    </OpsShell>
  );
}
