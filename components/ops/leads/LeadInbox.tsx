'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import DemandWorkspace from '@/components/ops/demand/DemandWorkspace';
import AddHousingComLeadDialog from '@/components/ops/leads/AddHousingComLeadDialog';

export default function LeadInbox() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          Add Housing.com Lead
        </Button>
      </div>
      <DemandWorkspace key={refreshKey} />
      <AddHousingComLeadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  );
}
