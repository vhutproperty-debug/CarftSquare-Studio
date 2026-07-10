'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

type OpsHeaderProps = {
  title?: string;
  subtitle?: string;
};

export default function OpsHeader({ title, subtitle }: OpsHeaderProps) {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/admin';
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-start justify-between gap-4 px-4 py-4 md:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 md:hidden">
            CraftSquare Ops
          </p>
          {title ? <h1 className="truncate text-xl font-black text-slate-900 md:text-2xl">{title}</h1> : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/admin">Admin</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
