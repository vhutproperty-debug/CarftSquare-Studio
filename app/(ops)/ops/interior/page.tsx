import InteriorDesk from '@/components/ops/interior/InteriorDesk';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function InteriorPage() {
  return (
    <OpsShell title="Interior" subtitle="Enquiry through handover for the interior team." dense>
      <InteriorDesk />
    </OpsShell>
  );
}
