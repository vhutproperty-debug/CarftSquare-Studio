import OpsShell from '@/components/ops/OpsShell';
import OpsIntelligenceDashboard from '@/components/ops/intelligence/OpsIntelligenceDashboard';

export default function OpsIntelligencePage() {
  return (
    <OpsShell
      title="Operations Intelligence"
      subtitle="Cross-pipeline rollup — revenue, agreements, renewals, and broker performance."
    >
      <OpsIntelligenceDashboard />
    </OpsShell>
  );
}
