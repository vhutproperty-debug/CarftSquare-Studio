import UnifiedInbox from '@/components/ops/crm/UnifiedInbox';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function InboxPage() {
  return (
    <OpsShell title="Lead inbox" subtitle="Requirements, demand, and WhatsApp in one list. Records are not merged." dense>
      <UnifiedInbox />
    </OpsShell>
  );
}
