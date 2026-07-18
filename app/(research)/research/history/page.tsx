import ResearchPageFrame from '@/components/research/ResearchPageFrame';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchHistoryPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchPageFrame
      title="History"
      subtitle="Past research runs and activity"
      emptyTitle="No research history"
      emptyDescription="Completed and failed research runs will be listed here for audit and replay."
      userLabel={userLabel}
    />
  );
}
