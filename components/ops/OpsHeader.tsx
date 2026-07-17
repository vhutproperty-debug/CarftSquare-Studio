'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OPS_PRODUCT } from '@/lib/ops/business';

type OpsHeaderProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  onOpenMobileNav?: () => void;
  dense?: boolean;
};

export default function OpsHeader({
  title,
  subtitle,
  actions,
  onOpenMobileNav,
  dense = false,
}: OpsHeaderProps) {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/admin';
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div
        className={`flex items-center justify-between gap-3 px-3 md:px-5 ${
          dense ? 'min-h-14 py-2' : 'min-h-[3.75rem] py-2.5'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onOpenMobileNav ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0 md:hidden"
              onClick={onOpenMobileNav}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-orange-600 md:hidden">
              {OPS_PRODUCT.name}
            </p>
            {title ? (
              <h1 className="truncate text-lg font-bold leading-tight text-slate-900 md:text-xl">{title}</h1>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 md:text-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {actions}
          <Button asChild variant="outline" size="sm" className="hidden h-8 sm:inline-flex">
            <Link href="/admin">Admin</Link>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
