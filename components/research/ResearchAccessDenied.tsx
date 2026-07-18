export default function ResearchAccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Access denied</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          {message || 'You do not have permission to access Prop/Research.'}
        </p>
        <a
          href="/admin"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          Back to Admin
        </a>
      </div>
    </div>
  );
}
