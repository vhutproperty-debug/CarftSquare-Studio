'use client';

import MetaBusinessPanel from '@/components/ops/meta/MetaBusinessPanel';
import OpsShell from '@/components/ops/OpsShell';

export default function MetaBusinessPage() {
  return (
    <OpsShell
      title="Meta Business"
      subtitle="Owned ad accounts and Pages for CraftSquare Properties, read from the Graph API."
      workspace
      pipelineStage="demand"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        <MetaBusinessPanel />
      </div>
    </OpsShell>
  );
}
