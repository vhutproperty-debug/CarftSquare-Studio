import OpsShell from '@/components/ops/OpsShell';
import ContactDetail from '@/components/ops/contacts/ContactDetail';

export const dynamic = 'force-dynamic';

export default function OpsContactDetailPage({ params }: { params: { id: string } }) {
  return (
    <OpsShell
      title="Contact"
      subtitle="Timeline, notes, and call outcomes. Existing details stay locked unless you are a super admin."
      pipelineStage="supply"
    >
      <ContactDetail contactId={params.id} />
    </OpsShell>
  );
}
