import OperationsPanel from '@/components/research/OperationsPanel';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchOperationsPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Operations"
      subtitle="Worker health, connector reliability, and monitoring observability"
      userLabel={userLabel}
    >
      <OperationsPanel />
    </ResearchShell>
  );
}
