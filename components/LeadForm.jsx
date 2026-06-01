'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const defaultLead = {
  name: '',
  phone: '',
  location: '',
  service: 'residential-interiors',
  propertyType: 'apartment',
  bhk: '2BHK',
  area: 750,
  paintQuality: 'premium',
  projectType: 'repaint',
  preferredSlot: 'Today / Tomorrow',
  notes: '',
  website: '',
};

function trackAnalyticsEvent(eventName, parameters = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, parameters);
  }
}

function formatCurrency(value = 0) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

export function SelectField({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
    >
      {children}
    </select>
  );
}

export default function LeadForm({ compact = false, onLeadCreated }) {
  const [form, setForm] = useState(defaultLead);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function calculate() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not calculate estimate');
      setEstimate(data.estimate);
      return data.estimate;
    } catch (error) {
      setMessage(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function submitLead(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const currentEstimate = estimate || await calculate();
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, estimate: currentEstimate, source: compact ? 'sticky_popup' : 'homepage' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not submit lead');
      setMessage(data.message || 'Inspection booked.');
      trackAnalyticsEvent('generate_lead', {
        event_category: 'conversion',
        event_label: 'Lead form submission',
        service: form.service,
        source: compact ? 'sticky_popup' : 'homepage',
      });
      setForm((current) => ({ ...defaultLead, phone: current.phone }));
      setEstimate(data.lead?.estimate || currentEstimate);
      onLeadCreated?.(data.lead);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-0 bg-white/95 shadow-2xl shadow-orange-950/15 backdrop-blur">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black">Book Free Consultation</CardTitle>
            <p className="mt-1 text-sm text-slate-300">Complete Interior Solutions • Mumbai</p>
          </div>
          <Badge className="bg-orange-500 text-white hover:bg-orange-500">30 sec</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <form onSubmit={submitLead} className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Your name" required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Mumbai mobile number" required />
            </Field>
          </div>
          <Field label="Area / Society">
            <Input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Bandra, Powai, Andheri" />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Service">
              <SelectField value={form.service} onChange={(value) => update('service', value)}>
                <optgroup label="Interior Services">
                  <option value="residential-interiors">Residential Interiors</option>
                  <option value="commercial-interiors">Commercial Interiors</option>
                  <option value="rental-interiors">Rental Furnishing</option>
                  <option value="modular-kitchens">Modular Kitchens</option>
                  <option value="modular-wardrobes">Modular Wardrobes</option>
                  <option value="renovation-remodeling">Renovation & Remodeling</option>
                  <option value="turnkey-projects">Turnkey Projects</option>
                </optgroup>
                <optgroup label="Design Services">
                  <option value="space-planning">Space Planning</option>
                  <option value="interior-styling">Interior Styling</option>
                  <option value="design-consultation">Design Consultation</option>
                </optgroup>
              </SelectField>
            </Field>
            <Field label="Carpet area (sq.ft)">
              <Input type="number" value={form.area} onChange={(event) => update('area', event.target.value)} min="150" />
            </Field>
            {!compact && (
              <>
                <Field label="BHK">
                  <SelectField value={form.bhk} onChange={(value) => update('bhk', value)}>
                    <option>1BHK</option>
                    <option>2BHK</option>
                    <option>3BHK</option>
                    <option>4BHK+</option>
                    <option>Villa</option>
                    <option>Commercial</option>
                  </SelectField>
                </Field>
                <Field label="Finish level">
                  <SelectField value={form.paintQuality} onChange={(value) => update('paintQuality', value)}>
                    <option value="economy">Economy</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="luxury">Luxury</option>
                  </SelectField>
                </Field>
              </>
            )}
          </div>
          {!compact && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Project type">
                <SelectField value={form.projectType} onChange={(value) => update('projectType', value)}>
                  <option value="repaint">Renovation / Upgrade</option>
                  <option value="fresh">New / Fresh Project</option>
                </SelectField>
              </Field>
              <Field label="Consultation slot">
                <SelectField value={form.preferredSlot} onChange={(value) => update('preferredSlot', value)}>
                  <option>Today / Tomorrow</option>
                  <option>This Weekend</option>
                  <option>Next Week</option>
                </SelectField>
              </Field>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={calculate} disabled={loading} className="border-orange-200 font-bold text-orange-700 hover:bg-orange-50">
              Calculate Cost
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-orange-600 font-black text-white hover:bg-orange-700">
              {loading ? 'Working...' : 'Get Free Quote'} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {estimate && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Instant estimate</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{estimate.formattedRange}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <span>Material: <b>{formatCurrency(estimate.materialEstimate)}</b></span>
                <span>Labor: <b>{formatCurrency(estimate.laborEstimate)}</b></span>
                <span>Timeline: <b>{estimate.timelineDays} days</b></span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{estimate.recommendation}</p>
            </div>
          )}
          {message && <p className={`text-sm font-semibold ${message.includes('Thank you') || message.includes('captured') || message.includes('booked') ? 'text-emerald-600' : 'text-red-600'}`}>{message}</p>}
          <input type="text" value={form.website} onChange={(event) => update('website', event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </form>
      </CardContent>
    </Card>
  );
}
