import OpsShell from '@/components/ops/OpsShell';
import LeadInbox from '@/components/ops/leads/LeadInbox';

export default function OpsLeadsPage() {
  return (
    <OpsShell
      title="Unified Lead Inbox"
      subtitle="Read-only leads from homepage, painting, campaigns, callbacks, and quotations."
    >
      <LeadInbox />
    </OpsShell>
  );
}
