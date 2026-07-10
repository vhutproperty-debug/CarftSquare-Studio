'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { canAccess } from '@/lib/auth/rbac/client';

type OpsAuthGateProps = {
  children: ReactNode;
};

export default function OpsAuthGate({ children }: OpsAuthGateProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        const response = await fetch('/api/auth/status', { credentials: 'include' });
        const data = await response.json();
        if (!data.authenticated) {
          router.replace('/admin?returnTo=/ops');
          return;
        }
        if (!canAccess(data.user, 'ops', 'view')) {
          router.replace('/admin?denied=ops');
          return;
        }
        setReady(true);
      } catch {
        router.replace('/admin?returnTo=/ops');
      }
    }
    verify();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        Checking access…
      </div>
    );
  }

  return children;
}
