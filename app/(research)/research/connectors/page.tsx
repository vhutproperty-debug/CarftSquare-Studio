import ConnectorsPanel from '@/components/research/ConnectorsPanel';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchConnectorsPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Connectors"
      subtitle="Portal sessions — live status, reconnect, and research readiness"
      userLabel={userLabel}
    >
      <ConnectorsPanel />
    </ResearchShell>
  );
}
