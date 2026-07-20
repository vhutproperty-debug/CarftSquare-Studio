import InventorySearchPanel from '@/components/research/InventorySearchPanel';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchInventoryPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Inventory Search"
      subtitle="Search knowledge-graph inventory by locality, BHK, and owner vs broker"
      userLabel={userLabel}
    >
      <InventorySearchPanel />
    </ResearchShell>
  );
}
