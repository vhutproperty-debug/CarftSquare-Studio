import OpsShell from '@/components/ops/OpsShell';
import ContactsWorkspace from '@/components/ops/contacts/ContactsWorkspace';

export const dynamic = 'force-dynamic';

export default function OpsContactsPage() {
  return (
    <OpsShell
      title="Contacts"
      subtitle="One directory for owners, tenants, brokers, and buyers. Phones and flat numbers stay visible so the team can dial."
      pipelineStage="supply"
    >
      <ContactsWorkspace />
    </OpsShell>
  );
}
