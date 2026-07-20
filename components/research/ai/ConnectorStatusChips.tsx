'use client';

import { useEffect, useState } from 'react';
import type { ConnectorStatusCard } from '@/lib/research/browser-gateway/types';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';

function chipTone(card: ConnectorStatusCard): {
  dot: string;
  label: string;
} {
  const state = card.displayState || card.status;
  if (state === 'connected') {
    return { dot: 'bg-emerald-500', label: card.portalName };
  }
  if (state === 'session_expired' || state === 'needs_login' || state === 'reconnecting') {
    return { dot: 'bg-amber-400', label: card.portalName };
  }
  if (state === 'connection_failed' || state === 'error') {
    return { dot: 'bg-rose-500', label: card.portalName };
  }
  return { dot: 'bg-slate-300', label: card.portalName };
}

/**
 * Compact connector health chips above the research prompt.
 * Consumes existing status API — no architecture changes.
 */
export default function ConnectorStatusChips() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [connectors, setConnectors] = useState<ConnectorStatusCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/research/connectors/status?workspaceId=${encodeURIComponent(workspaceId)}`,
          { credentials: 'include', cache: 'no-store' },
        );
        const json = await res.json();
        if (!cancelled && res.ok) {
          setConnectors(json.connectors || []);
        }
      } catch {
        /* ignore */
      }
    }
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [workspaceId]);

  if (!connectors.length) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {['Housing', 'MagicBricks', '99acres', 'NoBroker', 'Square Yards'].map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900/70"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-300" />
            {name}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Portal research coverage">
      {connectors.map((c) => {
        const tone = chipTone(c);
        return (
          <span
            key={c.portal}
            title={c.displayLabel || c.status}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
            {tone.label.replace(/\.com$/i, '')}
          </span>
        );
      })}
    </div>
  );
}
