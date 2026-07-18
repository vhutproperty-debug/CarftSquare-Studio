'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { ResearchNavIcon } from '@/components/research/research-nav-icons';
import { RESEARCH_NAV_ITEMS } from '@/lib/research/business';

type Props = {
  onOpenMenu: () => void;
};

export default function ResearchMobileNav({ onOpenMenu }: Props) {
  const pathname = usePathname();
  const primary = RESEARCH_NAV_ITEMS.slice(0, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
      <ul className="grid grid-cols-5 gap-1 px-1 py-1.5">
        {primary.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium ${
                  active
                    ? 'text-orange-700 dark:text-orange-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <ResearchNavIcon icon={item.icon} className="h-4 w-4" />
                <span className="truncate">{item.label.split(' ')[0]}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex w-full flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <Menu className="h-4 w-4" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
