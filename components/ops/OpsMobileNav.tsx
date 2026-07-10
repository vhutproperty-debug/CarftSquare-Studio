'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, LayoutDashboard, PhoneCall } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/ops', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/ops/leads', label: 'Leads', icon: Inbox, exact: false },
  { href: '/ops/calls', label: 'Calls', icon: PhoneCall, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function OpsMobileNav() {
  const pathname = usePathname() || '/ops';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 py-2 md:hidden">
      <ul className="grid grid-cols-3 gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${
                  active ? 'bg-orange-50 text-orange-700' : 'text-slate-600'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
