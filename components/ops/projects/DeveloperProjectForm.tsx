'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, selectClass } from '@/components/ops/projects/ui';
import { CHANNEL_PARTNER_LABELS, CHANNEL_PARTNER_STATUSES, DEVELOPER_STATUS_LABELS, DEVELOPER_STATUSES } from '@/lib/ops/projects/types';
import type { DeveloperProject, FloorPlan, ProjectContact, SalesOfficeField } from '@/lib/ops/projects/types';

export type DeveloperDraft = {
  name: string;
  slug: string;
  developer: string;
  locality: string;
  address: string;
  maharera: string;
  status: string;
  statusLabel: string;
  configLabel: string;
  priceLabel: string;
  possession: string;
  inventoryNote: string;
  offerNote: string;
  channelPartnerStatus: string;
  usps: string;
  amenities: string;
  brochureUrl: string;
  notes: string;
  sourceLinks: string;
  salesEmail: SalesOfficeField;
  cpEmail: SalesOfficeField;
  salesPhone: SalesOfficeField;
  contacts: ProjectContact[];
  floorPlans: FloorPlan[];
};

const emptyContact = (): ProjectContact => ({ name: '', role: '', phone: '', email: '' });
const emptySalesField = (): SalesOfficeField => ({ value: '', verification: 'unverified', note: '' });

export function emptyDeveloperDraft(): DeveloperDraft {
  return {
    name: '',
    slug: '',
    developer: '',
    locality: '',
    address: '',
    maharera: '',
    status: 'new_launch',
    statusLabel: '',
    configLabel: '',
    priceLabel: '',
    possession: '',
    inventoryNote: '',
    offerNote: '',
    channelPartnerStatus: 'not_approached',
    usps: '',
    amenities: '',
    brochureUrl: '',
    notes: '',
    sourceLinks: '',
    salesEmail: emptySalesField(),
    cpEmail: emptySalesField(),
    salesPhone: emptySalesField(),
    contacts: [],
    floorPlans: [],
  };
}

export function draftFromDeveloper(project: DeveloperProject): DeveloperDraft {
  return {
    name: project.name,
    slug: project.slug,
    developer: project.developer,
    locality: project.locality,
    address: project.address,
    maharera: project.maharera,
    status: project.status,
    statusLabel: project.statusLabel,
    configLabel: project.configLabel,
    priceLabel: project.priceLabel,
    possession: project.possession,
    inventoryNote: project.inventoryNote,
    offerNote: project.offerNote,
    channelPartnerStatus: project.channelPartnerStatus,
    usps: project.usps.join('\n'),
    amenities: project.amenities.join('\n'),
    brochureUrl: project.brochureUrl,
    notes: project.notes,
    sourceLinks: project.sourceLinks.join('\n'),
    salesEmail: project.salesEmail,
    cpEmail: project.cpEmail,
    salesPhone: project.salesPhone,
    contacts: project.contacts,
    floorPlans: project.floorPlans,
  };
}

export function developerPayload(draft: DeveloperDraft) {
  const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim() || undefined,
    developer: draft.developer.trim(),
    locality: draft.locality.trim(),
    address: draft.address.trim(),
    maharera: draft.maharera.trim(),
    status: draft.status,
    statusLabel: draft.statusLabel.trim(),
    configLabel: draft.configLabel.trim(),
    priceLabel: draft.priceLabel.trim(),
    possession: draft.possession.trim(),
    inventoryNote: draft.inventoryNote.trim(),
    offerNote: draft.offerNote.trim(),
    channelPartnerStatus: draft.channelPartnerStatus,
    usps: lines(draft.usps),
    amenities: lines(draft.amenities),
    brochureUrl: draft.brochureUrl.trim(),
    notes: draft.notes.trim(),
    sourceLinks: lines(draft.sourceLinks),
    salesEmail: draft.salesEmail,
    cpEmail: draft.cpEmail,
    salesPhone: draft.salesPhone,
    contacts: draft.contacts.filter((contact) => contact.name || contact.phone || contact.email || contact.role),
    floorPlans: draft.floorPlans.filter((plan) => plan.url && plan.url !== 'https://'),
  };
}

export default function DeveloperProjectForm({
  initial,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: DeveloperDraft;
  pending: boolean;
  submitLabel: string;
  onSubmit: (payload: ReturnType<typeof developerPayload>) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [uploadError, setUploadError] = useState('');

  function set<K extends keyof DeveloperDraft>(key: K, value: DeveloperDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setUploadError('');
    const body = new FormData();
    body.set('file', file);
    const response = await fetch('/api/ops/projects/uploads', { method: 'POST', body, credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setUploadError(payload.error || 'Unable to store that file. Paste a URL instead.');
      return;
    }
    const plan = payload.floorPlan as FloorPlan;
    setDraft((current) => ({
      ...current,
      floorPlans: [...current.floorPlans, { id: plan.id || plan.url, name: plan.name, url: plan.url, kind: plan.kind }],
    }));
  }

  function updateContact(index: number, key: keyof ProjectContact, value: string) {
    setDraft((current) => {
      const next = [...current.contacts];
      next[index] = { ...next[index], [key]: value };
      return { ...current, contacts: next };
    });
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(developerPayload(draft));
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Project name">
          <Input value={draft.name} onChange={(event) => set('name', event.target.value)} required aria-label="Project name" />
        </Field>
        <Field label="Slug">
          <Input value={draft.slug} onChange={(event) => set('slug', event.target.value)} placeholder="Generated from the name when left blank" aria-label="Slug" />
        </Field>
        <Field label="Developer">
          <Input value={draft.developer} onChange={(event) => set('developer', event.target.value)} aria-label="Developer" />
        </Field>
        <Field label="Locality">
          <Input value={draft.locality} onChange={(event) => set('locality', event.target.value)} aria-label="Locality" />
        </Field>
        <Field label="Address">
          <Input value={draft.address} onChange={(event) => set('address', event.target.value)} aria-label="Address" />
        </Field>
        <Field label="MahaRERA number">
          <Input value={draft.maharera} onChange={(event) => set('maharera', event.target.value)} aria-label="MahaRERA number" />
        </Field>
        <Field label="Status">
          <select className={selectClass} value={draft.status} onChange={(event) => set('status', event.target.value)} aria-label="Status">
            {DEVELOPER_STATUSES.map((status) => <option key={status} value={status}>{DEVELOPER_STATUS_LABELS[status]}</option>)}
          </select>
        </Field>
        <Field label="Status detail">
          <Input value={draft.statusLabel} onChange={(event) => set('statusLabel', event.target.value)} placeholder="Launched Jun 2025" aria-label="Status detail" />
        </Field>
        <Field label="Configuration and carpet">
          <Input value={draft.configLabel} onChange={(event) => set('configLabel', event.target.value)} aria-label="Configuration and carpet" />
        </Field>
        <Field label="Price range">
          <Input value={draft.priceLabel} onChange={(event) => set('priceLabel', event.target.value)} placeholder="₹3.2–5.1 Cr; ~₹46,000/sq ft" aria-label="Price range" />
        </Field>
        <Field label="Possession">
          <Input value={draft.possession} onChange={(event) => set('possession', event.target.value)} aria-label="Possession" />
        </Field>
        <Field label="Channel partner">
          <select className={selectClass} value={draft.channelPartnerStatus} onChange={(event) => set('channelPartnerStatus', event.target.value)} aria-label="Channel partner status">
            {CHANNEL_PARTNER_STATUSES.map((status) => <option key={status} value={status}>{CHANNEL_PARTNER_LABELS[status]}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Inventory / sold">
        <Input value={draft.inventoryNote} onChange={(event) => set('inventoryNote', event.target.value)} aria-label="Inventory" />
      </Field>
      <Field label="Offer">
        <Input value={draft.offerNote} onChange={(event) => set('offerNote', event.target.value)} aria-label="Offer" />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="USPs, one per line">
          <Textarea value={draft.usps} onChange={(event) => set('usps', event.target.value)} aria-label="USPs" />
        </Field>
        <Field label="Amenities, one per line">
          <Textarea value={draft.amenities} onChange={(event) => set('amenities', event.target.value)} aria-label="Amenities" />
        </Field>
      </div>
      <Field label="Brochure link">
        <Input value={draft.brochureUrl} onChange={(event) => set('brochureUrl', event.target.value)} placeholder="https://" aria-label="Brochure link" />
      </Field>
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Floor plans</p>
        <p className="text-sm text-slate-600">Upload an image or PDF, or paste a URL. Files stay on this server’s upload folder; a hosted https link is the durable option.</p>
        {draft.floorPlans.map((plan, index) => (
          <div key={`${plan.url}-${index}`} className="flex flex-wrap items-center gap-2">
            <Input
              value={plan.name}
              aria-label={`Floor plan ${index + 1} name`}
              onChange={(event) => {
                const next = [...draft.floorPlans];
                next[index] = { ...plan, name: event.target.value };
                set('floorPlans', next);
              }}
              className="max-w-xs"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{plan.url}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => set('floorPlans', draft.floorPlans.filter((_, item) => item !== index))}>Remove</Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            aria-label="Upload floor plan"
            className="text-sm text-slate-700"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              onUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set('floorPlans', [...draft.floorPlans, { id: `url-${draft.floorPlans.length}`, name: 'Floor plan', url: 'https://', kind: 'image' }])}
          >
            Add URL
          </Button>
        </div>
        {uploadError ? <p className="text-sm text-rose-700">{uploadError}</p> : null}
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Public sales office</p>
        <p className="text-sm text-slate-600">Company desk contacts. Mark a field verified only after someone on the team has checked it.</p>
        <SalesFieldEditor label="Sales email" field={draft.salesEmail} onChange={(salesEmail) => set('salesEmail', salesEmail)} />
        <SalesFieldEditor label="Channel partner email" field={draft.cpEmail} onChange={(cpEmail) => set('cpEmail', cpEmail)} />
        <SalesFieldEditor label="Sales phone" field={draft.salesPhone} onChange={(salesPhone) => set('salesPhone', salesPhone)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Team contacts</p>
          <Button type="button" variant="outline" size="sm" onClick={() => set('contacts', [...draft.contacts, emptyContact()])}>Add contact</Button>
        </div>
        <p className="text-sm text-slate-600">Visible to the ops team on this screen only. These numbers are not published on the website.</p>
        {draft.contacts.map((contact, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
            <Input aria-label={`Contact ${index + 1} name`} placeholder="Name" value={contact.name} onChange={(event) => updateContact(index, 'name', event.target.value)} />
            <Input aria-label={`Contact ${index + 1} role`} placeholder="Role" value={contact.role} onChange={(event) => updateContact(index, 'role', event.target.value)} />
            <Input aria-label={`Contact ${index + 1} phone`} placeholder="Phone" value={contact.phone} onChange={(event) => updateContact(index, 'phone', event.target.value)} />
            <Input aria-label={`Contact ${index + 1} email`} placeholder="Email" value={contact.email} onChange={(event) => updateContact(index, 'email', event.target.value)} />
            <div className="md:col-span-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => set('contacts', draft.contacts.filter((_, item) => item !== index))}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
      <Field label="Notes">
        <Textarea value={draft.notes} onChange={(event) => set('notes', event.target.value)} aria-label="Notes" />
      </Field>
      <Field label="Source links, one per line">
        <Textarea value={draft.sourceLinks} onChange={(event) => set('sourceLinks', event.target.value)} aria-label="Source links" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : submitLabel}</Button>
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : null}
      </div>
    </form>
  );
}

function SalesFieldEditor({
  label,
  field,
  onChange,
}: {
  label: string;
  field: SalesOfficeField;
  onChange: (next: SalesOfficeField) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_9rem]">
      <Field label={label}>
        <Input aria-label={label} value={field.value} onChange={(event) => onChange({ ...field, value: event.target.value })} />
      </Field>
      <Field label="Check">
        <select
          className={selectClass}
          aria-label={`${label} verification`}
          value={field.verification}
          onChange={(event) => onChange({
            ...field,
            verification: event.target.value === 'verified' ? 'verified' : 'unverified',
            note: event.target.value === 'verified' ? 'Verified by the team.' : field.note,
          })}
        >
          <option value="unverified">Unverified</option>
          <option value="verified">Verified</option>
        </select>
      </Field>
      {field.note ? <p className="text-xs text-slate-500 md:col-span-2">{field.note}</p> : null}
    </div>
  );
}
