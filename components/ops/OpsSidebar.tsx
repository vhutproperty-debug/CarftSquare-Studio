'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { OpsNavIcon } from '@/components/ops/ops-nav-icons';
import { Button } from '@/components/ui/button';
import { OPS_NAV_SECTIONS, OPS_PRODUCT } from '@/lib/ops/business';

const SIDEBAR_STORAGE_KEY = 'ops-sidebar-collapsed';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type OpsSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

function NavSections({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {OPS_NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4 last:mb-0">
          {!collapsed ? (
            <p className="mb-1.5 truncate px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
          ) : (
            <div className="mb-1.5 border-t border-slate-100" aria-hidden="true" />
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = item.href ? isActive(pathname, item.href, item.exact) : false;
              const disabled = item.status === 'coming_soon' || !item.href;

              if (disabled) {
                return (
                  <li key={item.label}>
                    <span
                      className={`flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-400 ${
                        collapsed ? 'justify-center' : ''
                      }`}
                      title={`${item.label} — coming soon`}
                    >
                      <OpsNavIcon icon={item.icon} className="h-4 w-4 shrink-0 opacity-50" />
                      {!collapsed ? (
                        <>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                            Soon
                          </span>
                        </>
                      ) : null}
                    </span>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href!}
                    title={collapsed ? item.label : undefined}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      active
                        ? 'bg-orange-50 text-orange-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <OpsNavIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                    {!collapsed ? <span className="min-w-0 flex-1 truncate whitespace-nowrap">{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function OpsSidebar({
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
}: OpsSidebarProps) {
  const pathname = usePathname() || '/ops';

  const brandBlock = (
    <Link href="/ops" className="flex min-w-0 items-center gap-2.5" onClick={() => onMobileOpenChange(false)}>
      <BrandLogo className="h-7 w-auto shrink-0" />
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">CraftSquare</p>
          <p className="truncate text-[11px] font-medium leading-tight text-slate-500">{OPS_PRODUCT.tagline}</p>
        </div>
      ) : null}
    </Link>
  );

  const footer = !collapsed ? (
    <div className="border-t border-slate-200 px-3 py-3">
      <Link
        href="/admin"
        className="block truncate text-xs font-medium text-slate-500 hover:text-orange-600"
        onClick={() => onMobileOpenChange(false)}
      >
        ← Back to Admin
      </Link>
    </div>
  ) : (
    <div className="border-t border-slate-200 p-2">
      <Link
        href="/admin"
        title="Back to Admin"
        className="flex items-center justify-center rounded-md py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-orange-600"
      >
        Admin
      </Link>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[4.25rem]' : 'w-[15.5rem]'
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-3">
          {brandBlock}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-slate-500"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <NavSections pathname={pathname} collapsed={collapsed} />
        {footer}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close navigation"
            onClick={() => onMobileOpenChange(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[16.5rem] max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-3">
              <Link href="/ops" className="flex min-w-0 items-center gap-2.5" onClick={() => onMobileOpenChange(false)}>
                <BrandLogo className="h-7 w-auto shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight text-slate-900">CraftSquare</p>
                  <p className="truncate text-[11px] font-medium leading-tight text-slate-500">{OPS_PRODUCT.tagline}</p>
                </div>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onMobileOpenChange(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <NavSections pathname={pathname} collapsed={false} onNavigate={() => onMobileOpenChange(false)} />
            <div className="border-t border-slate-200 px-3 py-3">
              <Link
                href="/admin"
                className="block text-xs font-medium text-slate-500 hover:text-orange-600"
                onClick={() => onMobileOpenChange(false)}
              >
                ← Back to Admin
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function useOpsSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  function onCollapsedChange(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  }

  return {
    collapsed,
    onCollapsedChange,
    mobileOpen,
    onMobileOpenChange: setMobileOpen,
  };
}

export type OpsSidebarChrome = ReturnType<typeof useOpsSidebarState>;

export function OpsSidebarProvider({
  children,
}: {
  children: (state: OpsSidebarChrome) => ReactNode;
}) {
  const state = useOpsSidebarState();
  return <>{children(state)}</>;
}
