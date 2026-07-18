import ResearchDashboard from '@/components/research/ResearchDashboard';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchDashboardPage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;
  return <ResearchDashboard userLabel={userLabel} />;
}
