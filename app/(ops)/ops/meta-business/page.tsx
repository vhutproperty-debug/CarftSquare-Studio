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
      <MetaBusinessPanel />
    </OpsShell>
  );
}
