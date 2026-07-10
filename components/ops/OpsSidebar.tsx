'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, LayoutDashboard, PhoneCall } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';

const NAV_ITEMS = [
  { href: '/ops', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/ops/leads', label: 'Leads', icon: Inbox, exact: false },
  { href: '/ops/calls', label: 'Calls', icon: PhoneCall, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
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
            <p className="text-sm font-bold text-slate-900">Operations</p>
            <p className="text-xs text-slate-500">CraftSquare internal</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-orange-50 text-orange-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
        <Link href="/admin" className="font-medium text-slate-600 hover:text-orange-600">
          ← Back to Admin
        </Link>
      </div>
    </aside>
  );
}
