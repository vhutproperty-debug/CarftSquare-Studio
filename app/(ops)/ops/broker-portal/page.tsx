import BrokerPortal from '@/components/ops/crm/BrokerPortal';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function BrokerPortalPage() {
  return (
    <OpsShell title="Broker portal" subtitle="Redacted inventory for external brokers. The internal broker CRM is unchanged." dense>
      <BrokerPortal />
    </OpsShell>
  );
}
