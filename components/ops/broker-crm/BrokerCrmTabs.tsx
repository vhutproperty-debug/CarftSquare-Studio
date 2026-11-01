import Link from 'next/link';

export default function BrokerCrmTabs({
  current,
  base = '/ops/broker-crm',
}: {
  current: 'directory' | 'queue';
  base?: string;
}) {
  const directory = base;
  const queue = `${base}/queue`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-slate-200/70 p-1">
        <Link
          href={directory}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${current === 'directory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          aria-current={current === 'directory' ? 'page' : undefined}
        >
          Directory
        </Link>
        <Link
          href={queue}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${current === 'queue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          aria-current={current === 'queue' ? 'page' : undefined}
        >
          WhatsApp priority queue
        </Link>
      </div>
    </div>
  );
}
