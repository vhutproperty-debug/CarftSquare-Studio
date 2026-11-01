'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminBadge, PriorityBadge, StatusBadge } from '@/components/ops/broker-crm/badges';
import { budgetBandsFor } from '@/lib/ops/broker-crm/bands';
import { formatBrokerPhone } from '@/lib/ops/broker-crm/format';
import { applyBrokerCrmPatch, type BrokerCrmPatch } from '@/lib/ops/broker-crm/patch';
import { isPriorityBroker } from '@/lib/ops/broker-crm/priority';
import { brokerAreaLabels, brokerProjectLabels } from '@/lib/ops/broker-crm/tags';
import {
  BROKER_CRM_STATUSES,
  BROKER_CRM_STATUS_LABELS,
  type BrokerCrmIntent,
  type BrokerCrmStatus,
  type OpsBrokerCrmRecord,
} from '@/lib/ops/broker-crm/types';

const BHK_OPTIONS = ['Studio', '1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5 BHK'];

type DraftRequirement = {
  id: string;
  bhk: string;
  budgetBandId: string;
  area: string;
  project: string;
  intent: BrokerCrmIntent;
  active: boolean;
};

function newRequirementId(): string {
  return globalThis.crypto.randomUUID();
}

export default function BrokerCrmDetail({
  brokerId,
  initial,
  backHref,
}: {
  brokerId?: string;
  initial?: OpsBrokerCrmRecord | null;
  backHref: string;
}) {
  const preview = initial !== undefined;
  const [broker, setBroker] = useState<OpsBrokerCrmRecord | null>(initial || null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial?.name || '');
  const [status, setStatus] = useState<BrokerCrmStatus>(initial?.status || 'new');
  const [lastContactedAt, setLastContactedAt] = useState(initial?.lastContactedAt || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [areaTags, setAreaTags] = useState<string[]>(initial?.areaTags || []);
  const [projectTags, setProjectTags] = useState<string[]>(initial?.projectTags || []);
  const [areaInput, setAreaInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [reason, setReason] = useState(initial?.doNotContactReason || '');
  const [requirements, setRequirements] = useState<DraftRequirement[]>(initial?.requirements || []);

  useEffect(() => {
    if (preview || !brokerId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/ops/broker-crm/${brokerId}`, { credentials: 'include' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (!cancelled) setError(body.error || 'Unable to load this broker.');
          return;
        }
        if (cancelled) return;
        applyRecord(body.broker);
      } catch {
        if (!cancelled) setError('Unable to load this broker.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [brokerId, preview]);

  function applyRecord(record: OpsBrokerCrmRecord) {
    setBroker(record);
    setName(record.name);
    setStatus(record.status);
    setLastContactedAt(record.lastContactedAt || '');
    setNotes(record.notes);
    setAreaTags(record.areaTags);
    setProjectTags(record.projectTags);
    setReason(record.doNotContactReason || '');
    setRequirements(record.requirements.map((item) => ({ ...item })));
  }

  const derivedAreas = broker ? broker.derivedAreas : [];
  const derivedProjects = broker ? broker.derivedProjects : [];
  const priority = broker ? isPriorityBroker(broker.groupCount, broker.admin) : false;

  const patch = useMemo<BrokerCrmPatch>(() => ({
    name,
    status,
    notes,
    lastContactedAt: lastContactedAt || null,
    areaTags,
    projectTags,
    doNotContactReason: reason || null,
    requirements,
  }), [areaTags, lastContactedAt, name, notes, projectTags, reason, requirements, status]);

  async function save() {
    if (!broker) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (preview) {
        const next = applyBrokerCrmPatch(broker, patch, new Date().toISOString());
        applyRecord(next);
        setNotice('Saved in this sample preview. Nothing was sent.');
        return;
      }
      const response = await fetch(`/api/ops/broker-crm/${broker.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error || 'Unable to save this broker.');
        return;
      }
      applyRecord(body.broker);
      setNotice('Saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save this broker.');
    } finally {
      setSaving(false);
    }
  }

  function addTag(kind: 'area' | 'project') {
    const value = (kind === 'area' ? areaInput : projectInput).trim();
    if (!value) return;
    if (kind === 'area') {
      setAreaTags((current) => current.some((item) => item.toLowerCase() === value.toLowerCase()) ? current : [...current, value]);
      setAreaInput('');
    } else {
      setProjectTags((current) => current.some((item) => item.toLowerCase() === value.toLowerCase()) ? current : [...current, value]);
      setProjectInput('');
    }
  }

  function updateRequirement(index: number, partial: Partial<DraftRequirement>) {
    setRequirements((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...partial } : item)));
  }

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        id: newRequirementId(),
        bhk: '2 BHK',
        budgetBandId: 'rent_60_80',
        area: derivedAreas[0] || '',
        project: derivedProjects[0] || '',
        intent: 'rent',
        active: true,
      },
    ]);
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Loading broker…</div>;
  }
  if (!broker) {
    return (
      <div className="space-y-3">
        <Link href={backHref} className="text-sm font-medium text-slate-900 underline">Back to brokers</Link>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error || 'Broker not found.'}</div>
      </div>
    );
  }

  const areas = brokerAreaLabels({ derivedAreas, areaTags });
  const projects = brokerProjectLabels({ derivedProjects, projectTags });

  return (
    <div className="space-y-4">
      <Link href={backHref} className="text-sm font-medium text-slate-900 underline">Back to brokers</Link>
      {preview ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Sample broker. The phone number is invented.
        </div>
      ) : null}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{broker.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{formatBrokerPhone(broker.phone)}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {priority ? <PriorityBadge /> : null}
              {broker.admin ? <AdminBadge /> : null}
              <StatusBadge status={broker.status} />
            </div>
          </div>
          <p className="text-sm text-slate-600">{broker.groupCount} group{broker.groupCount === 1 ? '' : 's'}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {broker.groups.map((group) => (
            <span key={group} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{group}</span>
          ))}
        </div>
        {status === 'do-not-contact' ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900">
            Do not contact. This broker is excluded from outreach export and from every WhatsApp priority wave. This screen does not send messages.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-slate-900">
            Name
            <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Status
            <select
              aria-label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as BrokerCrmStatus)}
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              {BROKER_CRM_STATUSES.map((item) => <option key={item} value={item}>{BROKER_CRM_STATUS_LABELS[item]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Last contacted
            <Input className="mt-1" type="date" value={lastContactedAt || ''} onChange={(event) => setLastContactedAt(event.target.value)} />
          </label>
          {status === 'do-not-contact' ? (
            <label className="block text-sm font-medium text-slate-900">
              Reason
              <Input className="mt-1" value={reason || ''} onChange={(event) => setReason(event.target.value)} placeholder="Asked not to be contacted" />
            </label>
          ) : null}
          <label className="block text-sm font-medium text-slate-900">
            Internal notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-slate-500">Notes stay inside ops. They are not copied to Market or to an outreach file.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-900">Areas</p>
            <p className="mt-1 text-xs text-slate-500">From groups: {derivedAreas.join(', ') || 'None inferred'}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {areaTags.map((tag) => (
                <button key={tag} type="button" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs" onClick={() => setAreaTags((current) => current.filter((item) => item !== tag))}>
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input aria-label="Add area tag" value={areaInput} onChange={(event) => setAreaInput(event.target.value)} placeholder="Add an area" />
              <Button type="button" variant="outline" onClick={() => addTag('area')}>Add</Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Projects</p>
            <p className="mt-1 text-xs text-slate-500">From groups: {derivedProjects.join(', ') || 'None inferred'}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {projectTags.map((tag) => (
                <button key={tag} type="button" className="rounded-full bg-slate-100 px-2 py-0.5 text-xs" onClick={() => setProjectTags((current) => current.filter((item) => item !== tag))}>
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input aria-label="Add project tag" value={projectInput} onChange={(event) => setProjectInput(event.target.value)} placeholder="Add a project" />
              <Button type="button" variant="outline" onClick={() => addTag('project')}>Add</Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">Showing {areas.join(', ') || 'no areas'} · {projects.join(', ') || 'no projects'}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Requirements</h3>
            <p className="mt-1 text-sm text-slate-600">
              BHK, budget band, area, and rent or buy feed the Market board while the broker is new, contacted, or active. Flat numbers, owner details, prices, and commercial terms are not on this form.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRequirement}>Add requirement</Button>
        </div>
        {(status === 'dormant' || status === 'do-not-contact') ? (
          <p className="mt-3 text-sm text-amber-900">These requirements stay on the record and stay off the Market board at this status.</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {requirements.length === 0 ? <p className="text-sm text-slate-500">No requirements yet.</p> : null}
          {requirements.map((item, index) => {
            const bands = budgetBandsFor(item.intent);
            return (
              <div key={item.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-6">
                <select aria-label="BHK" value={item.bhk} onChange={(event) => updateRequirement(index, { bhk: event.target.value })} className="h-9 rounded-md border border-slate-200 px-2 text-sm">
                  {BHK_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
                <select aria-label="Rent or buy" value={item.intent} onChange={(event) => {
                  const intent = event.target.value as BrokerCrmIntent;
                  const nextBands = budgetBandsFor(intent);
                  updateRequirement(index, { intent, budgetBandId: nextBands[0]?.id || '' });
                }} className="h-9 rounded-md border border-slate-200 px-2 text-sm">
                  <option value="rent">Rent</option>
                  <option value="buy">Buy</option>
                </select>
                <select aria-label="Budget band" value={item.budgetBandId} onChange={(event) => updateRequirement(index, { budgetBandId: event.target.value })} className="h-9 rounded-md border border-slate-200 px-2 text-sm md:col-span-2">
                  {bands.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}
                </select>
                <Input aria-label="Requirement area" value={item.area} onChange={(event) => updateRequirement(index, { area: event.target.value })} placeholder="Area" />
                <Input aria-label="Requirement project" value={item.project} onChange={(event) => updateRequirement(index, { project: event.target.value })} placeholder="Project" />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 md:col-span-5">
                  <input type="checkbox" checked={item.active} onChange={(event) => updateRequirement(index, { active: event.target.checked })} />
                  Active on the Market board
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</div> : null}
      <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save broker'}</Button>
    </div>
  );
}
