'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, MessageSquare, Phone, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ConfidenceBadge from '@/components/ops/brokers/ConfidenceBadge';
import type {
  AssistantListingCard,
  AssistantSearchResponse,
  AssistantSearchState,
} from '@/lib/ops/brokers/assistant/types';
import { buildTelLink } from '@/lib/ops/phone';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  listings?: AssistantListingCard[];
  total?: number;
  interpretedAs?: string[];
};

const SUGGESTIONS = [
  "Show today's inventory",
  'Find 2 BHK in Goregaon',
  'Search by broker',
  "Search WhatsApp for 'keys with me'",
  'Show fresh listings',
  'Furnished 3 BHK under 1 lakh',
];

function formatMoney(value?: number): string {
  if (value == null) return '—';
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatWhen(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

type Props = {
  onViewListing: (id: string) => void;
};

export default function BrokerAssistantPanel({ onViewListing }: Props) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<AssistantSearchState | undefined>();
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask anything about your broker inventory — I’ll translate it into a structured search and show matching listings. You can refine with follow-ups like “only furnished” or “under 70k”.',
    },
  ]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, loading]);

  async function ask(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setError('');
    setLoading(true);
    setInput('');
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setTurns((prev) => [...prev, userTurn]);

    try {
      const res = await fetch('/api/ops/brokers/assistant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, previousState: state }),
      });
      const data = (await res.json().catch(() => ({}))) as AssistantSearchResponse & {
        error?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Assistant search failed.');
        setTurns((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: 'assistant',
            content: 'I hit a problem running that search. Please try again.',
          },
        ]);
        return;
      }

      setState(data.state);
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          listings: data.listings,
          total: data.total,
          interpretedAs: data.interpretedAs,
        },
      ]);
    } catch {
      setError('Assistant search failed.');
    } finally {
      setLoading(false);
    }
  }

  async function copyListing(listing: AssistantListingCard) {
    const text = [
      listing.projectName || 'Unknown project',
      listing.configuration || '',
      listing.rent != null ? `Rent ${formatMoney(listing.rent)}` : '',
      listing.brokerName || '',
      listing.brokerPhone || '',
      listing.groupName || '',
      listing.originalMessage || '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-[min(78vh,820px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Sparkles className="h-4 w-4 text-slate-700" />
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Search Assistant</p>
          <p className="text-xs text-slate-500">
            Natural language over your WhatsApp broker inventory
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[920px] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{turn.content}</p>
              {turn.interpretedAs?.length ? (
                <p className="mt-2 text-[11px] text-slate-500">
                  Understood: {turn.interpretedAs.join(' · ')}
                </p>
              ) : null}

              {turn.listings?.length ? (
                <div className="mt-3 space-y-3">
                  {turn.listings.map((listing) => (
                    <div
                      key={listing.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {listing.projectName || 'Unknown project'}
                            {listing.configuration ? ` · ${listing.configuration}` : ''}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {listing.transactionType === 'SALE'
                              ? `Sale ${formatMoney(listing.salePrice)}`
                              : `Rent ${formatMoney(listing.rent)}`}
                            {listing.furnishing && listing.furnishing !== 'UNKNOWN'
                              ? ` · ${listing.furnishing.replace(/_/g, ' ')}`
                              : ''}
                          </p>
                        </div>
                        <ConfidenceBadge value={listing.overallConfidence} />
                      </div>

                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
                        <div>
                          <dt className="text-slate-400">Broker</dt>
                          <dd className="font-medium text-slate-800">{listing.brokerName || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Phone</dt>
                          <dd className="font-medium text-slate-800">{listing.brokerPhone || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">WhatsApp group</dt>
                          <dd className="font-medium text-slate-800">{listing.groupName || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Posted</dt>
                          <dd className="font-medium text-slate-800">{formatWhen(listing.postedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Freshness</dt>
                          <dd className="font-medium text-slate-800">{listing.freshnessStatus || '—'}</dd>
                        </div>
                      </dl>

                      {listing.originalMessage ? (
                        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Original WhatsApp message
                          </p>
                          <p className="whitespace-pre-wrap">{listing.originalMessage}</p>
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => onViewListing(listing.id)}>
                          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copyListing(listing)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Copy
                        </Button>
                        {listing.brokerPhone && buildTelLink(listing.brokerPhone) ? (
                          <Button size="sm" variant="outline" asChild>
                            <a href={buildTelLink(listing.brokerPhone) || undefined}>
                              <Phone className="mr-1.5 h-3.5 w-3.5" />
                              Call Broker
                            </a>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" onClick={() => onViewListing(listing.id)}>
                          Open Original Message
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Searching inventory…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      <div className="border-t border-slate-100 px-4 py-3">
        {!turns.some((t) => t.role === 'user') ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your broker inventory..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {state && Object.keys(state).length ? (
          <p className="mt-2 text-[11px] text-slate-400">
            Active filters carry across follow-ups. Type “clear” to reset.
          </p>
        ) : null}
      </div>
    </div>
  );
}
