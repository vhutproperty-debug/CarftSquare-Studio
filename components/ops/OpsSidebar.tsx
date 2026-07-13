'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import { OpsNavIcon } from '@/components/ops/ops-nav-icons';
import { OPS_NAV_SECTIONS, OPS_PILLARS, OPS_PRODUCT } from '@/lib/ops/business';

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function OpsSidebar() {
  const pathname = usePathname() || '/ops';

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-5 py-5">
        <Link href="/ops" className="flex items-center gap-3">
          <BrandLogo className="h-8 w-auto" />
          <div>
            <p className="text-sm font-bold text-slate-900">{OPS_PRODUCT.name}</p>
            <p className="text-xs text-slate-500">{OPS_PRODUCT.tagline}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-600">
              {OPS_PRODUCT.market}
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {OPS_NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href ? isActive(pathname, item.href, item.exact) : false;
                const disabled = item.status === 'coming_soon' || !item.href;

                if (disabled) {
                  return (
                    <li key={item.label}>
                      <span
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400"
                        title={`${item.label} — coming in a future phase`}
                      >
                        <OpsNavIcon icon={item.icon} className="h-4 w-4 opacity-50" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href!}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <OpsNavIcon icon={item.icon} className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-slate-200 px-5 py-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Four pillars</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {(Object.keys(OPS_PILLARS) as Array<keyof typeof OPS_PILLARS>).map((key) => (
              <span
                key={key}
                className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                {OPS_PILLARS[key].shortLabel}
              </span>
            ))}
          </div>
        </div>
        <Link href="/admin" className="text-xs font-medium text-slate-600 hover:text-orange-600">
          ← Back to Admin
        </Link>
      </div>
    </aside>
  );
}
