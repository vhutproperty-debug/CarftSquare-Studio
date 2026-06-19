'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  OPEN_DESIGNER_CALLBACK_EVENT,
  readConsultationContext,
} from '@/lib/estimate/consultation-context';
import { splitFullName, trackLeadFromSource } from '@/lib/meta-pixel';

const PROJECT_TYPES = ['Home', 'Office', 'Commercial', 'Rental Property', 'Other'] as const;

export default function DesignerCallbackWidget() {
  const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    projectType: '',
    message: '',
    preferredCallTime: '',
  });
  const [fromAiChat, setFromAiChat] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    const openFromChat = () => {
      resetForm();
      const ctx = readConsultationContext();
      if (ctx) {
        setFromAiChat(true);
        if (ctx.projectCategory) {
          setForm((f) => ({ ...f, projectType: ctx.projectCategory || f.projectType }));
        }
      }
      setOpen(true);
    };
    window.addEventListener(OPEN_DESIGNER_CALLBACK_EVENT, openFromChat);
    return () => window.removeEventListener(OPEN_DESIGNER_CALLBACK_EVENT, openFromChat);
  }, []);

  if (pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/free-interior-consultation')) return null;

  function resetForm() {
    setForm({ name: '', phone: '', city: '', projectType: '', message: '', preferredCallTime: '' });
    setFromAiChat(false);
    setError('');
    setSuccess(false);
    submittedRef.current = false;
  }

  function validate() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Please enter your full name.');
      return false;
    }
    const digits = form.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Please enter a valid 10-digit mobile number.');
      return false;
    }
    setError('');
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || loading || submittedRef.current) return;

    submittedRef.current = true;
    setLoading(true);
    setError('');

    try {
      const aiContext = fromAiChat || pathname.startsWith('/estimate') ? readConsultationContext() : null;
      const res = await fetch('/api/designer-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          landingPage: pathname,
          fromAiChat: Boolean(aiContext),
          aiContext: aiContext
            ? {
                moduleId: aiContext.moduleId,
                projectCategory: aiContext.projectCategory,
                phase: aiContext.phase,
                consultationId: aiContext.consultationId,
                answers: aiContext.answers,
                conversation: aiContext.conversation,
              }
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      if (!data.duplicate) {
        const { firstName, lastName } = splitFullName(form.name);
        trackLeadFromSource(
          'designer_callback',
          {
            project_type: form.projectType || undefined,
            landing_page: pathname,
          },
          {
            phone: form.phone,
            firstName,
            lastName,
          },
        );
      }
      setSuccess(true);
    } catch (err) {
      submittedRef.current = false;
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
        className="designer-callback-fab fixed bottom-5 right-5 z-[45] flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/90 px-4 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-orange-600/15 backdrop-blur-xl transition hover:scale-[1.02] hover:border-orange-300 hover:shadow-xl hover:shadow-orange-600/20 md:bottom-6 md:right-6 md:px-5 md:py-3.5 md:text-[15px]"
        aria-label="Talk to a Real Designer"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-600/30">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline">💬 Talk to a Real Designer</span>
        <span className="sm:hidden">💬 Designer</span>
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
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
                Our design team will contact you shortly.
              </p>
              <Button
                className="mt-8 h-12 rounded-2xl bg-orange-600 font-bold text-white hover:bg-orange-700"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="p-6 md:p-8">
              <DialogHeader className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Craft Square Studio</p>
                <DialogTitle
                  className="mt-2 text-2xl font-black text-slate-950 md:text-3xl"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  Talk to a Real Designer
                </DialogTitle>
                <DialogDescription className="text-sm leading-7 text-slate-600">
                  Request a callback from our senior interior design team. No obligation — just expert guidance.
                </DialogDescription>
              </DialogHeader>

              <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
                <Input
                  placeholder="Full name *"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="h-12 rounded-2xl border-slate-200 px-4"
                />
                <Input
                  placeholder="Mobile number *"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                  inputMode="tel"
                  className="h-12 rounded-2xl border-slate-200 px-4"
                />
                <select
                  value={form.preferredCallTime}
                  onChange={(e) => setForm((f) => ({ ...f, preferredCallTime: e.target.value }))}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800"
                >
                  <option value="">Preferred call time (optional)</option>
                  <option value="Morning (9am–12pm)">Morning (9am–12pm)</option>
                  <option value="Afternoon (12pm–4pm)">Afternoon (12pm–4pm)</option>
                  <option value="Evening (4pm–8pm)">Evening (4pm–8pm)</option>
                  <option value="Anytime">Anytime</option>
                </select>
                <Input
                  placeholder="City (optional)"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="h-12 rounded-2xl border-slate-200 px-4"
                />
                <select
                  value={form.projectType}
                  onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="">Project type (optional)</option>
                  {PROJECT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <Textarea
                  placeholder="Message (optional)"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="min-h-[96px] rounded-2xl border-slate-200 px-4 py-3"
                />

                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 font-black text-white shadow-lg shadow-orange-600/25 hover:from-orange-700 hover:to-orange-600"
                >
                  {loading ? 'Submitting...' : 'Request a Callback'}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </div>
          )}
        </DialogContent>
        )}
      </Dialog>
    </>
  );
}
