import OpsShell from '@/components/ops/OpsShell';
import MatchingWorkspace from '@/components/ops/matching/MatchingWorkspace';

export default function OpsMatchingPage() {
  return (
    <OpsShell
      title="Matching Engine"
      subtitle="Review deterministic demand–supply matches and advance confirmed pairs toward deals."
      pipelineStage="matching"
    >
      <MatchingWorkspace />
    </OpsShell>
  );
}
