import RequirementsDesk from '@/components/ops/crm/RequirementsDesk';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function RequirementsPage() {
  return (
    <OpsShell title="Client requirements" subtitle="Budget, configuration, and localities. Existing lead pages stay in place." dense>
      <RequirementsDesk />
    </OpsShell>
  );
}
