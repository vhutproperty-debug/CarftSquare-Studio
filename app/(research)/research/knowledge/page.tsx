import KnowledgeExplorer from '@/components/research/KnowledgeExplorer';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchKnowledgePage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Knowledge"
      subtitle="Real estate knowledge graph explorer"
      userLabel={userLabel}
    >
      <KnowledgeExplorer />
    </ResearchShell>
  );
}
