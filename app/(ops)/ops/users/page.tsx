import OpsAccessDenied from '@/components/ops/OpsAccessDenied';
import OpsShell from '@/components/ops/OpsShell';
import UserAdminScreen from '@/components/ops/users/UserAdminScreen';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export const dynamic = 'force-dynamic';

export default async function OpsUsersPage() {
  const auth = await resolveAuthStatusFromCookies();
  if (!auth.isSuperAdmin) {
    return <OpsAccessDenied message="Super Admin access is required to manage users." />;
  }

  return (
    <OpsShell
      title="Users"
      subtitle="Create a teammate and give them a role. Import, export, edit, and delete stay with you."
      dense
    >
      <UserAdminScreen />
    </OpsShell>
  );
}
