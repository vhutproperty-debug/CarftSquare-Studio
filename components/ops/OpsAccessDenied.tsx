'use client';

import Link from 'next/link';

type OpsAccessDeniedProps = {
  message?: string;
};

export default function OpsAccessDenied({
  message = 'You do not have permission to access Operations.',
}: OpsAccessDeniedProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Access Denied</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
        <Link
          href="/admin"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Return to Admin
        </Link>
      </div>
    </div>
  );
}
