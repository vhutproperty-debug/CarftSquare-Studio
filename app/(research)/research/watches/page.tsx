import WatchlistPanel from '@/components/research/WatchlistPanel';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchWatchesPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Watches"
      subtitle="Continuous monitoring for projects, localities, brokers, and queries"
      userLabel={userLabel}
    >
      <WatchlistPanel />
    </ResearchShell>
  );
}
