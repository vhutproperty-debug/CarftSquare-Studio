'use client';

import PageLeadConnect from '@/components/ops/meta/PageLeadConnect';
import PagesPanel from '@/components/ops/meta/PagesPanel';
import OpsShell from '@/components/ops/OpsShell';

export default function OpsPagesPage() {
  return (
    <OpsShell
      title="Pages"
      subtitle="Pages the system user can access, with fan count, lead forms, and the leadgen webhook."
      workspace
      pipelineStage="demand"
    >
      <div className="space-y-6">
        <PagesPanel />
        <PageLeadConnect />
      </div>
    </OpsShell>
  );
}
