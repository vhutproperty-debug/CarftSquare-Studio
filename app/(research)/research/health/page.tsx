import ResearchShell from '@/components/research/ResearchShell';
import WorkerHealthPanel from '@/components/research/WorkerHealthPanel';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchHealthPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Health"
      subtitle="Browser Worker status for local Prop/Research"
      userLabel={userLabel}
    >
      <WorkerHealthPanel />
    </ResearchShell>
  );
}
