export default function EstimateTypingIndicator({ label = 'CraftSquare AI is typing' }: { label?: string }) {
  return (
    <div className="estimate-fade-in flex justify-start">
      <div className="rounded-2xl border border-slate-100/80 bg-white/90 px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          {label}
          <span className="ml-1 inline-flex gap-0.5">
            <span className="estimate-dot inline-block h-1 w-1 rounded-full bg-orange-400" />
            <span className="estimate-dot inline-block h-1 w-1 rounded-full bg-orange-400" />
            <span className="estimate-dot inline-block h-1 w-1 rounded-full bg-orange-400" />
          </span>
        </p>
      </div>
    </div>
  );
}
