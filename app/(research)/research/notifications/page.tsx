import NotificationsCenter from '@/components/research/NotificationsCenter';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchNotificationsPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Notifications"
      subtitle="Evidence-backed market alerts from autonomous watches"
      userLabel={userLabel}
    >
      <NotificationsCenter />
    </ResearchShell>
  );
}
