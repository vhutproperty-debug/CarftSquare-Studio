import OpsAccessDenied from '@/components/ops/OpsAccessDenied';
import OpsShell from '@/components/ops/OpsShell';
import UserAdminScreen from '@/components/ops/users/UserAdminScreen';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';
import { phaseEnabled } from '@/lib/ops/os/flags';

export const dynamic = 'force-dynamic';

export default async function OpsUsersPage() {
  const auth = await resolveAuthStatusFromCookies();
  if (!auth.isSuperAdmin) {
    return <OpsAccessDenied message="Super Admin access is required to manage users." />;
  }

  if (!phaseEnabled(0)) {
    return (
      <OpsShell title="Users" subtitle="Role enforcement is already on." dense>
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          The user screen is off. Set CSOS_PHASE_0=1 to create teammates. Import, export, edit, and delete stay with the super admin either way.
        </p>
      </OpsShell>
    );
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
