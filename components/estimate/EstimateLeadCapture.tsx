'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EstimateLeadCapture({
  onSubmit,
  loading,
}: {
  onSubmit: (data: { name: string; phone: string; email: string }) => void;
  loading?: boolean;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const next: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      next.name = 'Please enter your full name.';
    }
    const digits = form.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      next.phone = 'Please enter a valid 10-digit mobile number.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Please enter a valid email address.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  return (
    <div className="estimate-glass-card estimate-fade-in-up rounded-[2rem] p-8 md:p-10">
      <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Almost There</p>
      <h2
        className="mt-3 text-2xl font-black text-slate-950 md:text-3xl"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        Get Your Personalised Estimate
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Share your contact details to receive your AI interior estimate, design recommendations, and budget range.
      </p>

      <form
        className="mt-8 grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validate()) return;
          onSubmit(form);
        }}
      >
        <div>
          <Input
            placeholder="Full name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="h-14 rounded-2xl border-slate-200 px-5"
          />
          {errors.name && <p className="mt-1 text-xs font-semibold text-red-600">{errors.name}</p>}
        </div>
        <div>
          <Input
            placeholder="Mobile number *"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            required
            inputMode="tel"
            className="h-14 rounded-2xl border-slate-200 px-5"
          />
          {errors.phone && <p className="mt-1 text-xs font-semibold text-red-600">{errors.phone}</p>}
        </div>
        <div>
          <Input
            type="email"
            placeholder="Email address (optional)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="h-14 rounded-2xl border-slate-200 px-5"
          />
          {errors.email && <p className="mt-1 text-xs font-semibold text-red-600">{errors.email}</p>}
        </div>
        <Button
          disabled={loading}
          className="h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 font-black text-white shadow-lg shadow-orange-600/25 hover:from-orange-700 hover:to-orange-600"
        >
          {loading ? 'Generating your estimate...' : 'Generate My AI Interior Report'}
          {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}
