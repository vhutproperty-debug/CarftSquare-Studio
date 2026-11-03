import LeadCaptureDesk from '@/components/ops/growth/LeadCaptureDesk';
import OpsShell from '@/components/ops/OpsShell';
import { growthModuleEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default function LeadCapturePage() {
  if (!growthModuleEnabled('LEAD_CAPTURE')) {
    return (
      <OpsShell title="Lead Capture" subtitle="Growth module" dense>
        <p className="text-sm text-slate-600">Lead Capture is off. Set CSOS_P7_LEAD_CAPTURE=1 to turn it on.</p>
      </OpsShell>
    );
  }
  return (
    <OpsShell title="Lead Capture" subtitle="Meta Instant Forms and WhatsApp enquiries, with the source kept on the row." pipelineStage="demand" dense>
      <LeadCaptureDesk />
    </OpsShell>
  );
}
