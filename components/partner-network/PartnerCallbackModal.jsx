'use client';

import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { splitFullName, trackLeadFromSource } from '@/lib/meta-pixel';

export default function PartnerCallbackModal({ open, onOpenChange }) {
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const submittedRef = useRef(false);

  function resetForm() {
    setName('');
    setMobile('');
    setError('');
    setSuccess(false);
    submittedRef.current = false;
  }

  function validate() {
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Please enter a valid 10-digit mobile number.');
      return false;
    }
    setError('');
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || loading || submittedRef.current) return;

    submittedRef.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/partner-network/callback-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      const digits = mobile.replace(/\D/g, '').slice(-10);
      const trimmedName = name.trim();
      const { firstName, lastName } = splitFullName(trimmedName || 'Partner Lead');
      trackLeadFromSource(
        'partner_callback',
        {
          form_source: 'partner_page',
          landing_page: '/partner',
        },
        {
          phone: digits,
          firstName,
          lastName,
        },
      );

      setSuccess(true);
    } catch (err) {
      submittedRef.current = false;
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
      {open && (
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[1.75rem] border-slate-100 bg-white p-0 sm:max-w-md">
          {success ? (
            <div className="p-8 text-center md:p-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3
                className="mt-5 text-2xl font-black text-slate-950"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Thank you!
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Our team will contact you shortly.
              </p>
              <Button
                className="mt-8 h-12 rounded-2xl bg-orange-600 font-bold text-white hover:bg-orange-700"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="p-6 md:p-8">
              <DialogHeader className="text-left">
                <DialogTitle
                  className="text-2xl font-black text-slate-950 md:text-3xl"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Interested in Becoming a CraftSquare Partner?
                </DialogTitle>
                <DialogDescription className="text-sm leading-7 text-slate-600">
                  Just share your mobile number and our partnership team will contact you shortly.
                </DialogDescription>
              </DialogHeader>

              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                <Input
                  placeholder="Mobile number *"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  required
                  inputMode="tel"
                  className="h-12 rounded-2xl border-slate-200 px-4"
                />
                <Input
                  placeholder="Name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 px-4"
                />

                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 font-black text-white shadow-lg shadow-orange-600/25 hover:from-orange-700 hover:to-orange-600"
                >
                  {loading ? 'Submitting...' : 'Request Callback'}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </div>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
