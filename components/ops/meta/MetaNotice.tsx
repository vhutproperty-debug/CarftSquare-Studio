export default function MetaNotice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) return null;
  const pending = Boolean(error && error.includes('permission pending App Review'));
  const blocked = Boolean(error && error.toLowerCase().includes('blocked'));
  const tone = error
    ? (pending || blocked
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-rose-200 bg-rose-50 text-rose-800')
    : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return (
    <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      {error || message}
    </div>
  );
}
