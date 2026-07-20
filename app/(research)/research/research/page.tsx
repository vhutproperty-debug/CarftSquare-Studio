import Link from 'next/link';
import ResearchAnalystPanel from '@/components/research/ResearchAnalystPanel';
import ResearchShell from '@/components/research/ResearchShell';
import { resolveAuthStatusFromCookies } from '@/lib/auth/resolve-auth-status-from-cookies';

export default async function ResearchWorkspacePage() {
  const auth = await resolveAuthStatusFromCookies();
  const userLabel = auth.user?.email || auth.user?.name || undefined;

  return (
    <ResearchShell
      title="Research"
      subtitle="Executive AI property research workspace"
      userLabel={userLabel}
      dense
      actions={
        <Link
          href="/research/connectors"
          className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        >
          Connectors
        </Link>
      }
    >
      <ResearchAnalystPanel />
    </ResearchShell>
  );
}
