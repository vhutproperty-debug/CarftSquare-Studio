'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OpsNavIcon } from '@/components/ops/ops-nav-icons';

const MOBILE_NAV = [
  { href: '/ops', label: 'Overview', icon: 'overview' as const, exact: true },
  { href: '/ops/leads', label: 'Demand', icon: 'demand' as const },
  { href: '/ops/supply', label: 'Supply', icon: 'supply' as const },
  { href: '/ops/calls', label: 'Outreach', icon: 'supply' as const },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function OpsMobileNav() {
  const pathname = usePathname() || '/ops';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 py-2 md:hidden">
      <ul className="grid grid-cols-4 gap-1">
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${
                  active ? 'bg-orange-50 text-orange-700' : 'text-slate-600'
                }`}
              >
                <OpsNavIcon icon={item.icon} className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
