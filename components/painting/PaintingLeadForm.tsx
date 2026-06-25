'use client';

import { useState } from 'react';
import { ArrowRight, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PAINTING_LANDING_PATH,
  PAINTING_PHONE,
  PAINTING_WHATSAPP_URL,
} from '@/lib/painting/constants';
import { splitFullName, trackLeadFromSource } from '@/lib/meta-pixel';
import {
  trackPaintingCallClick,
  trackPaintingFormSubmit,
  trackPaintingWhatsAppClick,
} from '@/components/painting/PaintingAnalytics';

export default function PaintingLeadForm() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    const trimmedName = name.trim();
    const digits = mobile.replace(/\D/g, '').slice(-10);

    if (trimmedName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (location.trim().length < 2) {
      setError('Please enter your location in Mumbai.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/painting/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          mobile: digits,
          location: location.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit your request.');

      trackPaintingFormSubmit();
      const { firstName, lastName } = splitFullName(trimmedName);
      trackLeadFromSource(
        'painting_landing',
        { form_source: 'painting_landing', landing_page: PAINTING_LANDING_PATH },
        { phone: digits, firstName, lastName },
      );

      setSuccess(true);
      setName('');
      setMobile('');
      setLocation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="painting-card p-8 text-center">
        <p className="text-2xl font-bold text-slate-900">Thank you!</p>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Our painting specialist will contact you shortly to schedule your free site inspection.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-6 rounded-full"
          onClick={() => setSuccess(false)}
        >
          Submit another request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="painting-card space-y-4 p-6 md:p-8">
      <div>
        <h3 className="text-xl font-bold text-slate-900">Book Your Free Site Inspection</h3>
        <p className="mt-1 text-sm text-slate-500">Get a detailed painting estimate within 24 hours.</p>
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name *"
        required
        autoComplete="name"
        className="h-12 rounded-xl border-slate-200 bg-white"
      />
      <Input
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="Mobile number *"
        inputMode="tel"
        required
        autoComplete="tel"
        className="h-12 rounded-xl border-slate-200 bg-white"
      />
      <Input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location in Mumbai *"
        required
        autoComplete="address-level2"
        className="h-12 rounded-xl border-slate-200 bg-white"
      />

      {error && <p className="text-sm font-semibold text-red-600" role="alert">{error}</p>}

      <Button
        type="submit"
        disabled={loading}
        className="painting-cta-primary h-12 w-full text-base"
      >
        {loading ? 'Submitting…' : 'Submit'}
        {!loading && <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />}
      </Button>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={PAINTING_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="painting-cta-secondary inline-flex h-12 items-center justify-center gap-2 text-sm"
          onClick={() => trackPaintingWhatsAppClick('lead_form')}
        >
          <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          WhatsApp
        </a>
        <a
          href={`tel:${PAINTING_PHONE}`}
          className="painting-cta-secondary inline-flex h-12 items-center justify-center gap-2 text-sm"
          onClick={() => trackPaintingCallClick('lead_form')}
        >
          <Phone className="h-4 w-4 text-orange-600" aria-hidden="true" />
          Call Now
        </a>
      </div>
    </form>
  );
}
