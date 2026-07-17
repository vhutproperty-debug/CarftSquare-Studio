'use client';

import { useCallback, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OpsShell from '@/components/ops/OpsShell';
import DemandWorkspace from '@/components/ops/demand/DemandWorkspace';
import AddHousingComLeadDialog from '@/components/ops/leads/AddHousingComLeadDialog';

export default function LeadInbox() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleCreated = useCallback(() => {
    setRefreshToken((current) => current + 1);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshToken((current) => current + 1);
    window.setTimeout(() => setRefreshing(false), 400);
  }

  return (
    <OpsShell
      title="Demand"
      subtitle="Manage, qualify and advance incoming property enquiries."
      pipelineStage="demand"
      dense
      workspace
      actions={
        <>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Add Housing Lead</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col px-3 py-3 md:px-5 md:py-4">
        <DemandWorkspace refreshToken={refreshToken} />
      </div>
      <AddHousingComLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </OpsShell>
  );
}
