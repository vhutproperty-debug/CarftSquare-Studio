import ResearchPageFrame from '@/components/research/ResearchPageFrame';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchSettingsPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchPageFrame
      title="Settings"
      subtitle="Workspace preferences for Prop/Research"
      emptyTitle="Settings coming online"
      emptyDescription="Workspace defaults, notification preferences, and connector policies will be configured here."
      userLabel={userLabel}
    />
  );
}
