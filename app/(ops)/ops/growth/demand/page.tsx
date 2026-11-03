import DemandProfilerDesk from '@/components/ops/growth/DemandProfilerDesk';
import OpsShell from '@/components/ops/OpsShell';
import { growthModuleEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default function DemandProfilerPage() {
  if (!growthModuleEnabled('DEMAND_PROFILER')) {
    return (
      <OpsShell title="Demand Profiler" subtitle="Growth module" dense>
        <p className="text-sm text-slate-600">Demand Profiler is off. Set CSOS_P7_DEMAND_PROFILER=1 to turn it on.</p>
      </OpsShell>
    );
  }
  return (
    <OpsShell title="Demand Profiler" subtitle="Budget, configuration, location, possession, and intent, matched with filters." pipelineStage="demand" dense>
      <DemandProfilerDesk />
    </OpsShell>
  );
}
