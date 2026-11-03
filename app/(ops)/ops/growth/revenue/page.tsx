import RevenueDesk from '@/components/ops/growth/RevenueDesk';
import OpsShell from '@/components/ops/OpsShell';
import { growthModuleEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default function RevenueAttributionPage() {
  if (!growthModuleEnabled('REVENUE')) {
    return (
      <OpsShell title="Revenue Attribution" subtitle="Growth module" dense>
        <p className="text-sm text-slate-600">Revenue Attribution is off. Set CSOS_P7_REVENUE=1 to turn it on.</p>
      </OpsShell>
    );
  }
  return (
    <OpsShell title="Revenue Attribution" subtitle="Spend, qualified leads, visits, and verified brokerage by campaign." pipelineStage="revenue" dense>
      <RevenueDesk />
    </OpsShell>
  );
}
