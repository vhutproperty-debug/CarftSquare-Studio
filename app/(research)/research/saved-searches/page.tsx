import ResearchPageFrame from '@/components/research/ResearchPageFrame';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchSavedSearchesPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchPageFrame
      title="Saved Searches"
      subtitle="Reusable research criteria"
      emptyTitle="No saved searches"
      emptyDescription="Saved searches will appear here once you start capturing research templates."
      userLabel={userLabel}
    />
  );
}
