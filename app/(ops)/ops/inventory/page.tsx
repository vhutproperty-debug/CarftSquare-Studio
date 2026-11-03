import InventoryDesk from '@/components/ops/inventory/InventoryDesk';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function InventoryPage() {
  return (
    <OpsShell title="Inventory registry" subtitle="Developers, towers, canonical apartments, and rentals. Existing project pages stay available." dense>
      <InventoryDesk />
    </OpsShell>
  );
}
