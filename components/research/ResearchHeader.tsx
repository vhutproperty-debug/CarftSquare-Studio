'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE, RESEARCH_PRODUCT } from '@/lib/research/business';

type Props = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  onOpenMobileNav?: () => void;
  userLabel?: string;
};

export default function ResearchHeader({
  title,
  subtitle,
  actions,
  onOpenMobileNav,
  userLabel,
}: Props) {
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/admin';
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2 md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {onOpenMobileNav ? (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={onOpenMobileNav}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-orange-600 md:hidden">
              {RESEARCH_PRODUCT.name}
            </p>
            {title ? (
              <h1 className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-slate-100 md:text-xl">
                {title}
              </h1>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:inline-flex"
            aria-label="Workspace selector"
          >
            <span className="max-w-[140px] truncate">{DEFAULT_RESEARCH_WORKSPACE.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Notifications"
            title="Notifications coming soon"
          >
            <Bell className="h-4 w-4" />
          </button>

          {actions}

          <span className="hidden max-w-[120px] truncate text-xs text-slate-500 dark:text-slate-400 lg:inline">
            {userLabel || 'Signed in'}
          </span>

          <Link
            href="/admin"
            className="hidden h-8 items-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 sm:inline-flex"
          >
            Admin
          </Link>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
