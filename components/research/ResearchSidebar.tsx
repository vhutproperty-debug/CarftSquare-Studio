'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { ResearchNavIcon } from '@/components/research/research-nav-icons';
import {
  RESEARCH_NAV_GROUPS,
  RESEARCH_PRODUCT,
} from '@/lib/research/business';

const SIDEBAR_STORAGE_KEY = 'research-sidebar-collapsed';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function useResearchSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function onCollapsedChange(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  return {
    collapsed,
    onCollapsedChange,
    mobileOpen,
    onMobileOpenChange: setMobileOpen,
  };
}

export default function ResearchSidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: Props) {
  const pathname = usePathname();

  const nav = (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      <div className="space-y-4">
        {RESEARCH_NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {!collapsed ? (
              <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={() => onMobileOpenChange(false)}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        active
                          ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                      }`}
                    >
                      <ResearchNavIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                      {!collapsed ? (
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );

  const chrome = (
    <aside
      className={`flex h-full flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-100 px-3 dark:border-slate-800">
        {!collapsed ? (
          <Link href={RESEARCH_PRODUCT.homeHref} className="flex min-w-0 items-center gap-2">
            <BrandLogo className="h-7 w-auto" />
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {RESEARCH_PRODUCT.shortName}
            </span>
          </Link>
        ) : (
          <Link href={RESEARCH_PRODUCT.homeHref} className="mx-auto">
            <BrandLogo className="h-7 w-auto" />
          </Link>
        )}
        <button
          type="button"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:inline-flex dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onMobileOpenChange(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {nav}
      {!collapsed ? (
        <div className="border-t border-slate-100 px-3 py-3 text-[11px] text-slate-400 dark:border-slate-800">
          {RESEARCH_PRODUCT.name}
        </div>
      ) : null}
    </aside>
  );

  return (
    <>
      <div className="hidden md:block">{chrome}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close navigation overlay"
            onClick={() => onMobileOpenChange(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">{chrome}</div>
        </div>
      ) : null}
    </>
  );
}
