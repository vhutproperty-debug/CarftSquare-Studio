import ResearchLoadingState from '@/components/research/ai/ResearchLoadingState';

export default function ResearchLoading() {
  return (
    <div className="research-workspace-shell min-h-screen">
      <ResearchLoadingState label="Loading Prop/Research…" />
    </div>
  );
}
