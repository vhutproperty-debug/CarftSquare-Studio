import LeadIntelligenceDesk from '@/components/ops/growth/LeadIntelligenceDesk';
import OpsShell from '@/components/ops/OpsShell';
import { growthModuleEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default function LeadIntelligencePage() {
  if (!growthModuleEnabled('LEAD_INTELLIGENCE')) {
    return (
      <OpsShell title="Lead Intelligence" subtitle="Growth module" dense>
        <p className="text-sm text-slate-600">Lead Intelligence is off. Set CSOS_P7_LEAD_INTELLIGENCE=1 to turn it on.</p>
      </OpsShell>
    );
  }
  return (
    <OpsShell title="Lead Intelligence" subtitle="Source, duplicate review, and scores you can read from the weights." pipelineStage="demand" dense>
      <LeadIntelligenceDesk />
    </OpsShell>
  );
}
