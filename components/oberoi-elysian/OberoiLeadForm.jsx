'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  APARTMENT_OPTIONS,
  BUDGET_OPTIONS,
  OBJECTIVE_OPTIONS,
  OBEROI_LANDING_PATH,
  POSSESSION_MONTHS,
} from '@/lib/oberoi-elysian/content';
import { splitFullName, trackLeadFromSource } from '@/lib/meta-pixel';
import { GA_EVENTS, trackGaEvent } from '@/lib/analytics/ga4';

const INITIAL = {
  name: '',
  phone: '',
  email: '',
  apartment: '',
  possessionMonth: '',
  rentalBudget: '',
  investmentObjective: '',
};

export default function OberoiLeadForm() {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const name = form.name.trim();
    const phone = form.phone.trim();
    const digits = phone.replace(/\D/g, '').slice(-10);

    if (name.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    const message = [
      'Oberoi Elysian Pre-Possession Rental Consultation',
      `Apartment: ${form.apartment || '—'}`,
      `Expected Possession: ${form.possessionMonth || '—'}`,
      `Rental Budget: ${form.rentalBudget || '—'}`,
      `Investment Objective: ${form.investmentObjective || '—'}`,
      `Email: ${form.email.trim() || '—'}`,
    ].join('\n');

    setLoading(true);
    try {
      const res = await fetch('/api/designer-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: digits,
          city: 'Mumbai',
          projectType: 'Rental Property',
          message,
          landingPage: OBEROI_LANDING_PATH,
          fromAiChat: false,
          aiContext: {
            moduleId: 'oberoi-elysian-landing',
            phase: 'lead_form',
            answers: form,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit your request.');

      trackGaEvent(GA_EVENTS.CONTACT_FORM_SUBMITTED, {
        source: 'oberoi_elysian_landing',
        form_location: OBEROI_LANDING_PATH,
        project_type: 'Rental Property',
      });
      const { firstName, lastName } = splitFullName(name);
      trackLeadFromSource(
        'ai_interior_consultant',
        { form_source: 'oberoi_elysian_landing', landing_page: OBEROI_LANDING_PATH },
        { phone: digits, firstName, lastName },
      );

      setSuccess(true);
      setForm(INITIAL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="meta-glass-panel rounded-2xl p-8 text-center">
        <p className="text-2xl font-black text-[#FAF8F5]">Thank you!</p>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Our rental interior specialist will contact you shortly to plan your Oberoi Elysian home before possession.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="meta-glass-panel space-y-4 rounded-2xl p-6 md:p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Full name *"
          required
          className="h-12 rounded-xl border-white/10 bg-white/5 text-[#FAF8F5] placeholder:text-slate-500"
        />
        <Input
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          placeholder="Mobile number *"
          inputMode="tel"
          required
          className="h-12 rounded-xl border-white/10 bg-white/5 text-[#FAF8F5] placeholder:text-slate-500"
        />
        <Input
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="Email address"
          className="h-12 rounded-xl border-white/10 bg-white/5 text-[#FAF8F5] placeholder:text-slate-500 md:col-span-2"
        />
        <select
          value={form.apartment}
          onChange={(e) => update('apartment', e.target.value)}
          required
          className="h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-[#FAF8F5]"
        >
          <option value="" className="bg-[#121214]">Apartment configuration *</option>
          {APARTMENT_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="bg-[#121214]">{opt}</option>
          ))}
        </select>
        <select
          value={form.possessionMonth}
          onChange={(e) => update('possessionMonth', e.target.value)}
          required
          className="h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-[#FAF8F5]"
        >
          <option value="" className="bg-[#121214]">Expected possession month *</option>
          {POSSESSION_MONTHS.map((opt) => (
            <option key={opt} value={opt} className="bg-[#121214]">{opt}</option>
          ))}
        </select>
        <select
          value={form.rentalBudget}
          onChange={(e) => update('rentalBudget', e.target.value)}
          required
          className="h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-[#FAF8F5]"
        >
          <option value="" className="bg-[#121214]">Rental budget *</option>
          {BUDGET_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="bg-[#121214]">{opt}</option>
          ))}
        </select>
        <select
          value={form.investmentObjective}
          onChange={(e) => update('investmentObjective', e.target.value)}
          required
          className="h-12 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-[#FAF8F5]"
        >
          <option value="" className="bg-[#121214]">Investment objective *</option>
          {OBJECTIVE_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="bg-[#121214]">{opt}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="meta-cta-primary h-14 w-full rounded-full bg-orange-600 font-black text-white hover:bg-orange-500"
      >
        {loading ? 'Submitting…' : 'Reserve My Consultation'}
        {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
      </Button>
    </form>
  );
}
