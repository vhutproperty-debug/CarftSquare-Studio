'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EstimateLeadCapture({
  onSubmit,
  loading,
}: {
  onSubmit: (data: { name: string; phone: string }) => void;
  loading?: boolean;
}) {
  const [form, setForm] = useState({ name: '', phone: '' });

  return (
    <div className="estimate-glass-card rounded-[2rem] p-8 md:p-10">
      <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Final Step</p>
      <h2
        className="mt-3 text-2xl font-black text-slate-950 md:text-3xl"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        Let&apos;s Connect You with a Designer
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Share your name and mobile number — a Craft Square Studio designer will reach out to prepare your project.
      </p>

      <form
        className="mt-8 grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(form);
        }}
      >
        <Input
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          className="h-14 rounded-2xl border-slate-200 px-5"
        />
        <Input
          placeholder="Mobile number"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          required
          className="h-14 rounded-2xl border-slate-200 px-5"
        />
        <Button
          disabled={loading}
          className="h-14 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 font-black text-white shadow-lg shadow-orange-600/25 hover:from-orange-700 hover:to-orange-600"
        >
          {loading ? 'Preparing your report...' : 'Receive My AI Report'}
          {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
        </Button>
      </form>
    </div>
  );
}
