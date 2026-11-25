'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  PROPERTIES_CONSENT_TEXT,
  PROPERTIES_CONSENT_VERSION,
  PROPERTIES_INTENTS,
  PROPERTIES_PAGE_PATH,
  PROPERTIES_SUCCESS_MESSAGE,
} from '@/lib/properties/constants';
import { captureUtmFromSearch } from '@/lib/properties/utm';

type FieldErrors = Partial<Record<'name' | 'mobile' | 'email' | 'intent' | 'consent', string>>;

const INITIAL = {
  name: '',
  mobile: '',
  email: '',
  intent: '',
  area: '',
  budget: '',
  message: '',
  consent: false,
  companyWebsite: '',
};

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200';
const labelClass = 'block text-sm font-semibold text-slate-800';
const errorClass = 'mt-1 text-xs font-semibold text-red-600';

function digitsOnly(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

export function validatePropertiesForm(values: typeof INITIAL): FieldErrors {
  const errors: FieldErrors = {};
  if (values.name.trim().length < 2) errors.name = 'Please enter your name.';
  if (!/^[6-9]\d{9}$/.test(digitsOnly(values.mobile))) errors.mobile = 'Please enter a valid 10-digit mobile number.';
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!values.intent) errors.intent = 'Please choose what you want to do.';
  if (!values.consent) errors.consent = 'Please tick the consent box to continue.';
  return errors;
}

export default function PropertiesLeadForm() {
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverMessage, setServerMessage] = useState('');

  function update<K extends keyof typeof INITIAL>(key: K, value: (typeof INITIAL)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validatePropertiesForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus('idle');
      return;
    }
    setStatus('submitting');
    setServerMessage('');
    try {
      const response = await fetch('/api/properties/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          mobile: digitsOnly(values.mobile),
          email: values.email.trim() || undefined,
          intent: values.intent,
          area: values.area.trim() || undefined,
          budget: values.budget.trim() || undefined,
          message: values.message.trim() || undefined,
          consent: values.consent,
          consentVersion: PROPERTIES_CONSENT_VERSION,
          pagePath: typeof window !== 'undefined' ? window.location.pathname : PROPERTIES_PAGE_PATH,
          referrer: typeof document !== 'undefined' ? document.referrer.slice(0, 500) : '',
          utm: typeof window !== 'undefined' ? captureUtmFromSearch(window.location.search) : {},
          companyWebsite: values.companyWebsite,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const fieldErrors = (data?.fieldErrors || {}) as Record<string, string[] | undefined>;
        const mapped: FieldErrors = {};
        (['name', 'mobile', 'email', 'intent', 'consent'] as const).forEach((key) => {
          if (fieldErrors[key]?.[0]) mapped[key] = fieldErrors[key]?.[0];
        });
        setErrors(mapped);
        setServerMessage(data?.error || 'Submission failed. Please try again or WhatsApp us.');
        setStatus('error');
        return;
      }
      setServerMessage(data?.message || PROPERTIES_SUCCESS_MESSAGE);
      setStatus('success');
      setValues(INITIAL);
    } catch {
      setServerMessage('Network error. Please try again or WhatsApp us.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center" role="status" data-testid="properties-lead-success">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <p className="mt-4 text-lg font-black text-slate-950">Request received</p>
        <p className="mt-2 text-sm text-slate-700">{serverMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8" data-testid="properties-lead-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="pl-name" className={labelClass}>Name *</label>
          <input id="pl-name" name="name" autoComplete="name" className={inputClass} value={values.name} onChange={(e) => update('name', e.target.value)} maxLength={80} aria-invalid={Boolean(errors.name)} />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="pl-mobile" className={labelClass}>Mobile *</label>
          <div className="mt-1 flex">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-600">+91</span>
            <input id="pl-mobile" name="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile" className={`${inputClass} mt-0 rounded-l-none`} value={values.mobile} onChange={(e) => update('mobile', e.target.value)} maxLength={14} aria-invalid={Boolean(errors.mobile)} />
          </div>
          {errors.mobile && <p className={errorClass}>{errors.mobile}</p>}
        </div>
        <div>
          <label htmlFor="pl-email" className={labelClass}>Email <span className="font-normal text-slate-500">(optional)</span></label>
          <input id="pl-email" name="email" type="email" autoComplete="email" className={inputClass} value={values.email} onChange={(e) => update('email', e.target.value)} maxLength={120} aria-invalid={Boolean(errors.email)} />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>
        <div className="sm:col-span-2">
          <span className={labelClass}>I want to *</span>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="I want to">
            {PROPERTIES_INTENTS.map((intent) => {
              const active = values.intent === intent.id;
              return (
                <button
                  type="button"
                  key={intent.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => update('intent', intent.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-orange-400'}`}
                >
                  {intent.label}
                </button>
              );
            })}
          </div>
          {errors.intent && <p className={errorClass}>{errors.intent}</p>}
        </div>
        <div>
          <label htmlFor="pl-area" className={labelClass}>Preferred area or project <span className="font-normal text-slate-500">(optional)</span></label>
          <input id="pl-area" name="area" className={inputClass} value={values.area} onChange={(e) => update('area', e.target.value)} maxLength={120} placeholder="e.g. Goregaon West" />
        </div>
        <div>
          <label htmlFor="pl-budget" className={labelClass}>Budget <span className="font-normal text-slate-500">(optional)</span></label>
          <input id="pl-budget" name="budget" className={inputClass} value={values.budget} onChange={(e) => update('budget', e.target.value)} maxLength={80} placeholder="e.g. ₹1.5 Cr or ₹60k/month" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pl-message" className={labelClass}>Message <span className="font-normal text-slate-500">(optional)</span></label>
          <textarea id="pl-message" name="message" rows={3} className={inputClass} value={values.message} onChange={(e) => update('message', e.target.value)} maxLength={1000} />
        </div>
        <div className="hidden" aria-hidden="true">
          <label htmlFor="pl-company-website">Company website</label>
          <input id="pl-company-website" name="companyWebsite" tabIndex={-1} autoComplete="off" value={values.companyWebsite} onChange={(e) => update('companyWebsite', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <input
              type="checkbox"
              name="consent"
              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-400 accent-orange-600"
              checked={values.consent}
              onChange={(e) => update('consent', e.target.checked)}
              aria-invalid={Boolean(errors.consent)}
              data-testid="properties-consent"
            />
            <span>
              {PROPERTIES_CONSENT_TEXT}{' '}
              See our{' '}
              <Link href="/privacy-policy" className="font-semibold text-orange-600 underline hover:text-orange-700" target="_blank">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.consent && <p className={errorClass}>{errors.consent}</p>}
        </div>
      </div>
      {status === 'error' && serverMessage && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">{serverMessage}</p>
      )}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-orange-600 px-6 py-3 text-sm font-black text-white hover:bg-orange-700 disabled:opacity-60"
      >
        {status === 'submitting' ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>) : 'Send my requirement'}
      </button>
    </form>
  );
}
