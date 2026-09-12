'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatPhoneDisplay } from '@/lib/ops/phone';
import type { InteraktConversation, InteraktLinkCandidate, InteraktMessage } from '@/lib/interakt/types';

type Metrics = {
  total: number;
  unread: number;
  unmatched: number;
  ambiguous: number;
  matched: number;
};

type FilterId = 'all' | 'unread' | 'unmatched' | 'ambiguous' | 'matched';

function matchLabel(status: InteraktConversation['matchStatus']) {
  switch (status) {
    case 'matched':
      return 'Matched';
    case 'manually_linked':
      return 'Linked';
    case 'ambiguous':
      return 'Ambiguous';
    default:
      return 'Unmatched';
  }
}

export default function WhatsAppInbox() {
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<InteraktConversation[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InteraktMessage[]>([]);
  const [selected, setSelected] = useState<InteraktConversation | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [bodyValues, setBodyValues] = useState('');
  const [sendStatus, setSendStatus] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter === 'unread') params.set('unreadOnly', 'true');
      if (filter === 'unmatched' || filter === 'ambiguous' || filter === 'matched') {
        params.set('matchStatus', filter === 'matched' ? 'matched' : filter);
      }
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/ops/whatsapp/conversations?${params}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to load conversations.');
        return;
      }
      setConversations(data.conversations || []);
      setMetrics(data.metrics || null);
    } catch {
      setError('Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    setSendStatus('');
    try {
      const res = await fetch(`/api/ops/whatsapp/conversations/${id}/messages`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setSelected(data.conversation || null);
      setMessages(data.messages || []);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
      );
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId, loadThread]);

  async function sendTemplate() {
    if (!selectedId || !templateName.trim()) return;
    setSendStatus('Sending…');
    const values = bodyValues
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    const res = await fetch(`/api/ops/whatsapp/conversations/${selectedId}/reply`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName: templateName.trim(),
        bodyValues: values.length ? values : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSendStatus(data.error || 'Send failed.');
      return;
    }
    setSendStatus('Template queued.');
    setTemplateName('');
    setBodyValues('');
    await loadThread(selectedId);
  }

  async function linkCandidate(candidate: InteraktLinkCandidate) {
    if (!selectedId) return;
    const res = await fetch(`/api/ops/whatsapp/conversations/${selectedId}/link`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    });
    if (!res.ok) return;
    await loadThread(selectedId);
    await loadQueue();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {([
            ['all', 'All'],
            ['unread', 'Unread'],
            ['unmatched', 'Unmatched'],
            ['ambiguous', 'Ambiguous'],
            ['matched', 'Matched'],
          ] as Array<[FilterId, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full px-3 py-1 ${
                filter === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone…"
          className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {metrics && (
          <p className="mb-3 text-xs text-slate-500">
            {metrics.total} threads · {metrics.unread} unread · {metrics.ambiguous} ambiguous
          </p>
        )}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  selectedId === c.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{formatPhoneDisplay(c.normalizedPhone)}</span>
                  {c.unreadCount > 0 && (
                    <span className={`rounded-full px-2 text-xs ${selectedId === c.id ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <div className={`mt-0.5 text-xs ${selectedId === c.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {matchLabel(c.matchStatus)}
                  {c.primaryLink?.label ? ` · ${c.primaryLink.label}` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {!selectedId && <p className="text-sm text-slate-500">Select a conversation.</p>}
        {selectedId && threadLoading && <p className="text-sm text-slate-500">Loading thread…</p>}
        {selected && !threadLoading && (
          <div className="flex h-full min-h-[60vh] flex-col">
            <header className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {formatPhoneDisplay(selected.normalizedPhone)}
              </h2>
              <p className="text-sm text-slate-500">
                {matchLabel(selected.matchStatus)}
                {selected.primaryLink
                  ? ` · ${selected.primaryLink.entityType} ${selected.primaryLink.label || selected.primaryLink.entityId}`
                  : ''}
              </p>
              {(selected.matchStatus === 'ambiguous' || selected.matchStatus === 'unmatched')
                && selected.candidateLinks.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Link to CRM record</p>
                  {selected.candidateLinks.map((c) => (
                    <button
                      key={`${c.entityType}:${c.source || ''}:${c.entityId}`}
                      type="button"
                      onClick={() => linkCandidate(c)}
                      className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{c.label || c.entityId}</span>
                      <span className="ml-2 text-xs text-slate-500">{c.entityType} · {c.matchField}</span>
                    </button>
                  ))}
                </div>
              )}
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.direction === 'inbound'
                      ? 'bg-slate-100 text-slate-900'
                      : 'ml-auto bg-emerald-700 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.bodyText || `(${m.messageType})`}</p>
                  <p className={`mt-1 text-[10px] ${m.direction === 'inbound' ? 'text-slate-500' : 'text-emerald-100'}`}>
                    {m.status} · {m.createdAt}
                  </p>
                </div>
              ))}
            </div>

            <footer className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs text-slate-500">
                Outbound uses Interakt approved templates (public API is Template-only). Free-form session replies remain in Interakt until a documented session API is available.
              </p>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template code name"
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                value={bodyValues}
                onChange={(e) => setBodyValues(e.target.value)}
                placeholder="Body variables (one per line)"
                rows={3}
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={sendTemplate}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Send template
                </button>
                {sendStatus && <span className="text-xs text-slate-500">{sendStatus}</span>}
              </div>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
