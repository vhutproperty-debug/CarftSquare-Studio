'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { OpsNavIcon } from '@/components/ops/ops-nav-icons';

const MOBILE_NAV = [
  { href: '/ops', label: 'Home', icon: 'overview' as const, exact: true },
  { href: '/ops/leads', label: 'Demand', icon: 'demand' as const },
  { href: '/ops/supply', label: 'Supply', icon: 'supply' as const },
  { href: '/ops/deals', label: 'Deals', icon: 'deal' as const },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type OpsMobileNavProps = {
  onOpenMenu?: () => void;
};

export default function OpsMobileNav({ onOpenMenu }: OpsMobileNavProps) {
  const pathname = usePathname() || '/ops';

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-1.5 py-1.5 md:hidden">
      <ul className="grid grid-cols-5 gap-0.5">
        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold text-slate-600"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            Menu
          </button>
        </li>
        {MOBILE_NAV.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-semibold ${
                  active ? 'bg-orange-50 text-orange-700' : 'text-slate-600'
                }`}
              >
                <OpsNavIcon icon={item.icon} className="h-4 w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
