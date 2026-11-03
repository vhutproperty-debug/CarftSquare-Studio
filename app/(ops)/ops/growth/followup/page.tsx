import FollowUpDesk from '@/components/ops/growth/FollowUpDesk';
import OpsShell from '@/components/ops/OpsShell';
import { growthModuleEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default function FollowUpPage() {
  if (!growthModuleEnabled('FOLLOWUP')) {
    return (
      <OpsShell title="Automated Follow-up" subtitle="Growth module" dense>
        <p className="text-sm text-slate-600">Automated Follow-up is off. Set CSOS_P7_FOLLOWUP=1 to turn it on.</p>
      </OpsShell>
    );
  }
  return (
    <OpsShell title="Automated Follow-up" subtitle="Approved WhatsApp templates, reminders, and delivery. Bulk sends need a super admin." pipelineStage="demand" dense>
      <FollowUpDesk />
    </OpsShell>
  );
}
