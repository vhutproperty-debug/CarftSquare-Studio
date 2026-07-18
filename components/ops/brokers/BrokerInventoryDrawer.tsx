'use client';

import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import ConfidenceBadge from '@/components/ops/brokers/ConfidenceBadge';
import {
  BROKER_FRESHNESS_LABELS,
  BROKER_TRANSACTION_LABELS,
} from '@/lib/ops/brokers/statuses';
import type {
  OpsBrokerInventory,
  OpsBrokerInventoryHistory,
  OpsBrokerRawMessage,
} from '@/lib/ops/brokers/types';
import { buildTelLink, buildWhatsAppLink } from '@/lib/ops/phone';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryId: string | null;
};

function formatMoney(value?: number): string {
  if (value == null) return '—';
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function formatWhen(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{value == null || value === '' ? '—' : value}</p>
    </div>
  );
}

export default function BrokerInventoryDrawer({ open, onOpenChange, inventoryId }: Props) {
  const [inventory, setInventory] = useState<OpsBrokerInventory | null>(null);
  const [messages, setMessages] = useState<OpsBrokerRawMessage[]>([]);
  const [changeHistory, setChangeHistory] = useState<OpsBrokerInventoryHistory[]>([]);
  const [demandMatches, setDemandMatches] = useState<Array<{
    demandKey: string;
    score: number;
    reasons: string[];
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !inventoryId) {
      setInventory(null);
      setMessages([]);
      setChangeHistory([]);
      setDemandMatches([]);
      return;
    }

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/ops/brokers/${inventoryId}?includeMatches=true`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || 'Unable to load inventory.');
          return;
        }
        setInventory(data.inventory);
        setMessages(data.sourceMessages || []);
        setChangeHistory(data.changeHistory || []);
        setDemandMatches(
          (data.demandMatches || []).map((m: { demandKey: string; score: number; reasons: string[] }) => ({
            demandKey: m.demandKey,
            score: m.score,
            reasons: m.reasons || [],
          })),
        );
      } catch {
        setError('Unable to load inventory.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, inventoryId]);

  const latest = messages.length ? messages[messages.length - 1] : null;
  const older = messages.length > 1 ? messages.slice(0, -1).reverse() : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{inventory?.projectName || 'Broker inventory'}</SheetTitle>
          <SheetDescription>
            Full source provenance back to the original WhatsApp message.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-rose-600">{error}</p>
        ) : inventory ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold">
                {BROKER_FRESHNESS_LABELS[inventory.freshnessStatus]}
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold">
                {BROKER_TRANSACTION_LABELS[inventory.transactionType]}
              </span>
              <ConfidenceBadge value={inventory.overallConfidence} />
              <span className="text-xs text-slate-500">
                Seen {inventory.occurrenceCount}× · {inventory.sourceType}
              </span>
            </div>

            {(inventory.parserConfidence != null) ? (
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                <span>Parser {inventory.parserConfidence}%</span>
                <span>Project {inventory.projectConfidence}%</span>
                <span>Config {inventory.configurationConfidence}%</span>
                <span>Price {inventory.priceConfidence}%</span>
                <span>Phone {inventory.phoneConfidence}%</span>
                <span>Overall {inventory.overallConfidence}%</span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Configuration" value={inventory.configuration} />
              <Field
                label={inventory.transactionType === 'SALE' ? 'Sale price' : 'Rent'}
                value={
                  inventory.transactionType === 'SALE'
                    ? formatMoney(inventory.salePrice)
                    : formatMoney(inventory.rent)
                }
              />
              <Field label="Tower / Wing" value={[inventory.tower, inventory.wing].filter(Boolean).join(' / ')} />
              <Field label="Unit" value={inventory.unitNumber} />
              <Field label="Furnishing" value={inventory.furnishing.replace(/_/g, ' ')} />
              <Field label="Parking" value={inventory.parking} />
              <Field label="Carpet area" value={inventory.carpetArea ? `${inventory.carpetArea} sqft` : undefined} />
              <Field label="Floor" value={inventory.floor} />
              <Field label="Deposit" value={formatMoney(inventory.deposit)} />
              <Field label="Availability" value={inventory.availability} />
              <Field label="First seen" value={formatWhen(inventory.firstSeenAt)} />
              <Field label="Last seen" value={formatWhen(inventory.lastSeenAt)} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Broker / contact</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{inventory.brokerName || 'Unknown contact'}</p>
              {inventory.brokerPhone ? (
                <p className="text-sm text-slate-600">{inventory.brokerPhone}</p>
              ) : (
                <p className="text-xs text-slate-500">No phone in export metadata</p>
              )}
              <p className="mt-2 text-sm text-slate-700">
                Group: <span className="font-medium">{inventory.groupName}</span>
              </p>
              {inventory.brokerPhone ? (
                <div className="mt-3 flex gap-2">
                  {buildTelLink(inventory.brokerPhone) ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={buildTelLink(inventory.brokerPhone) || undefined}>
                        <Phone className="mr-1 h-3.5 w-3.5" /> Call
                      </a>
                    </Button>
                  ) : null}
                  {buildWhatsAppLink(inventory.brokerPhone) ? (
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={buildWhatsAppLink(inventory.brokerPhone) || undefined}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Latest original message
              </p>
              {latest ? (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <p className="text-xs text-slate-500">
                    {latest.senderName || 'Unknown'}
                    {latest.senderPhone ? ` · ${latest.senderPhone}` : ''}
                    {' · '}
                    {latest.messageDate || ''} {latest.messageTime || ''}
                    {' · '}
                    {latest.sourceFileName}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-900">
                    {latest.rawMessage}
                  </pre>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No source message available.</p>
              )}
            </div>

            {changeHistory.length ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Change timeline
                </p>
                <ul className="mt-2 space-y-2">
                  {changeHistory.map((h) => (
                    <li key={h.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-800">{h.fieldChanged}</span>
                      <span className="text-slate-500"> · {formatWhen(h.changedAt)}</span>
                      <p className="mt-1 text-slate-700">
                        {String(h.oldValue ?? '—')} → {String(h.newValue ?? '—')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {older.length ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Previous source messages
                </p>
                <div className="mt-2 space-y-3">
                  {older.map((msg) => (
                    <div key={msg.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] text-slate-500">
                        {msg.messageDate} {msg.messageTime} · {msg.senderName || 'Unknown'}
                      </p>
                      <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
                        {msg.rawMessage}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {demandMatches.length ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Matching client demand
                </p>
                <ul className="mt-2 space-y-2">
                  {demandMatches.map((m) => (
                    <li key={m.demandKey} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{m.demandKey}</span>
                        <span className="text-xs font-semibold text-emerald-700">Score {m.score}</span>
                      </div>
                      {m.reasons?.length ? (
                        <p className="mt-1 text-xs text-slate-500">{m.reasons.slice(0, 3).join(' · ')}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
