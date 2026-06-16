'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import './partner-registration-form.css';

const INPUT_CLASS = 'partner-reg-input';
const SELECT_CLASS = 'partner-reg-input partner-reg-select';
const STORAGE_KEY = 'pn_registration_session';

function Field({ id, label, required, optional, children, className }) {
  const fieldId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className={cn('partner-reg-field', className)}>
      <label htmlFor={fieldId} className="partner-reg-label">
        {label}
        {required && <span className="text-orange-400" aria-hidden="true"> *</span>}
        {optional && <span style={{ color: '#E5E7EB', fontWeight: 500 }}> (Optional)</span>}
      </label>
      <div className="partner-reg-input-wrap">
        {typeof children === 'function' ? children(fieldId) : children}
      </div>
    </div>
  );
}

function FieldGroup({ title, description, children }) {
  return (
    <div className="partner-reg-group p-3 md:p-4">
      {title && (
        <div className="mb-3">
          <p className="partner-reg-group-title">{title}</p>
          {description && <p className="partner-reg-group-desc mt-1 text-sm font-medium">{description}</p>}
        </div>
      )}
      <div className="partner-reg-grid">{children}</div>
    </div>
  );
}

function getLeadSource() {
  if (typeof window === 'undefined') return 'organic';
  const params = new URLSearchParams(window.location.search);
  return params.get('utm_source')
    || params.get('utm_campaign')
    || params.get('ref')
    || (document.referrer?.includes('facebook') || document.referrer?.includes('instagram') ? 'meta_ads' : '')
    || 'organic';
}

function ProgressBar({ percent }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs font-semibold text-[#E5E7EB]">
        <span>Profile completion</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function PartnerRegistrationForm() {
  const [step, setStep] = useState(1);
  const [step1, setStep1] = useState({ fullName: '', mobile: '', email: '', companyName: '' });
  const [profile, setProfile] = useState({
    operatingAreas: '', dealType: 'both', projectsCovered: '', dealsPerMonth: '',
    whatsapp: '', reraNumber: '', city: 'Mumbai', state: 'Maharashtra', email: '',
  });
  const [session, setSession] = useState({ partnerId: '', mobile: '', profileCompletionPercent: 0 });
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.partnerId) {
        setSession(saved);
        setStep1({ fullName: saved.fullName || '', mobile: saved.mobile || '', email: saved.email || '', companyName: saved.companyName || '' });
        setStep(2);
      }
    } catch { /* ignore */ }
  }, []);

  const setStep1Field = (key, value) => setStep1((f) => ({ ...f, [key]: value }));
  const setProfileField = (key, value) => setProfile((f) => ({ ...f, [key]: value }));

  function persistSession(data) {
    const payload = {
      partnerId: data.partnerId,
      mobile: step1.mobile,
      fullName: step1.fullName,
      companyName: step1.companyName,
      email: step1.email,
      profileCompletionPercent: data.profileCompletionPercent ?? 25,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSession(payload);
  }

  async function handleStep1(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/partner-network/register/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...step1, leadSource: getLeadSource() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Registration failed');
      persistSession(data);
      setStep(2);
      setMessage('You\'re in! Complete your profile below to maximize partner benefits.');
    } catch (err) {
      setMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/partner-network/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          partnerId: session.partnerId,
          mobile: session.mobile || step1.mobile,
          ...profile,
          agreementAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Save failed');
      persistSession({ ...session, profileCompletionPercent: data.profileCompletionPercent });
      setSession((s) => ({ ...s, profileCompletionPercent: data.profileCompletionPercent }));
      if (data.profileCompletionPercent >= 100) {
        setDone(true);
        sessionStorage.removeItem(STORAGE_KEY);
        setMessage(data.message);
      } else {
        setMessage(data.message || 'Profile saved.');
      }
    } catch (err) {
      setMessage(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  function skipStep2() {
    setMessage('Your registration is saved. Our team may contact you to complete your profile.');
    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center text-white">
        <p className="text-2xl font-black text-orange-400">Partner ID: {session.partnerId}</p>
        <p className="mt-3 text-[#E5E7EB]">{message}</p>
        <p className="mt-2 text-sm font-medium text-[#9CA3AF]">We will notify you upon approval. You can also complete your profile anytime.</p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <form onSubmit={handleStep1} className="partner-reg-form mx-auto w-full max-w-xl space-y-3 text-white">
        <FieldGroup title="Join in 30 seconds" description="Start earning with CraftSquare — add details later.">
          <Field label="Full Name" required className="sm:col-span-2">
            {(id) => (
              <Input id={id} required value={step1.fullName} onChange={(e) => setStep1Field('fullName', e.target.value)} className={INPUT_CLASS} placeholder="Your full name" />
            )}
          </Field>
          <Field label="Mobile Number" required className="sm:col-span-2">
            {(id) => (
              <Input id={id} required type="tel" value={step1.mobile} onChange={(e) => setStep1Field('mobile', e.target.value)} className={INPUT_CLASS} placeholder="10-digit mobile" />
            )}
          </Field>
          <Field label="Email Address" required className="sm:col-span-2">
            {(id) => (
              <Input id={id} required type="email" value={step1.email} onChange={(e) => setStep1Field('email', e.target.value)} className={INPUT_CLASS} placeholder="you@company.com" />
            )}
          </Field>
          <Field label="Company / Firm Name" optional className="sm:col-span-2">
            {(id) => (
              <Input id={id} value={step1.companyName} onChange={(e) => setStep1Field('companyName', e.target.value)} className={INPUT_CLASS} placeholder="Agency or firm (optional)" />
            )}
          </Field>
        </FieldGroup>

        {message && <p role="alert" className={cn('text-center text-sm font-semibold', message.includes('in!') ? 'text-emerald-400' : 'text-red-400')}>{message}</p>}

        <div className="partner-reg-cta-bar fixed inset-x-0 bottom-0 z-50 border-t border-white/20 px-4 py-2.5 md:static md:z-auto md:border-0 md:px-0 md:py-0">
          <Button type="submit" disabled={loading} className="mx-auto h-12 w-full max-w-md rounded-full bg-orange-600 text-sm font-bold tracking-wide text-white shadow-lg shadow-orange-950/40 hover:bg-orange-500 disabled:opacity-60">
            {loading ? 'Saving...' : 'Become a CraftSquare Partner'}
          </Button>
        </div>
        <div className="h-14 md:hidden" aria-hidden="true" />
      </form>
    );
  }

  return (
    <form onSubmit={handleStep2} className="partner-reg-form mx-auto w-full max-w-2xl space-y-3 text-white">
      <div className="partner-reg-group p-3 md:p-4">
        <p className="partner-reg-group-title">Complete Your Partner Profile</p>
        <p className="partner-reg-group-desc mt-1 text-sm">
          Partner ID: <span className="font-bold text-orange-400">{session.partnerId}</span> — optional fields help us serve you faster.
        </p>
        <ProgressBar percent={session.profileCompletionPercent || 25} />
      </div>

      <FieldGroup title="Business Details" description="All fields optional — skip anytime.">
        <Field label="Operating Areas" optional>
          {(id) => <Input id={id} value={profile.operatingAreas} onChange={(e) => setProfileField('operatingAreas', e.target.value)} placeholder="e.g. Andheri, Powai, Thane" className={INPUT_CLASS} />}
        </Field>
        <Field label="Rental / Sales / Both" optional>
          <Select value={profile.dealType} onValueChange={(v) => setProfileField('dealType', v)}>
            <SelectTrigger className={SELECT_CLASS} aria-label="Rental, Sales, or Both"><SelectValue /></SelectTrigger>
            <SelectContent className="border-white/20 bg-slate-900 text-white">
              <SelectItem value="rental">Rental</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Projects Covered" optional>
          {(id) => <Input id={id} value={profile.projectsCovered} onChange={(e) => setProfileField('projectsCovered', e.target.value)} placeholder="e.g. 1BHK, 2BHK, Villas" className={INPUT_CLASS} />}
        </Field>
        <Field label="Deals Per Month" optional>
          {(id) => <Input id={id} value={profile.dealsPerMonth} onChange={(e) => setProfileField('dealsPerMonth', e.target.value)} placeholder="e.g. 5–10" className={INPUT_CLASS} />}
        </Field>
        <Field label="City" optional>
          {(id) => <Input id={id} value={profile.city} onChange={(e) => setProfileField('city', e.target.value)} className={INPUT_CLASS} placeholder="Mumbai" />}
        </Field>
        <Field label="State" optional>
          {(id) => <Input id={id} value={profile.state} onChange={(e) => setProfileField('state', e.target.value)} className={INPUT_CLASS} placeholder="Maharashtra" />}
        </Field>
        <Field label="WhatsApp" optional>
          {(id) => <Input id={id} type="tel" value={profile.whatsapp} onChange={(e) => setProfileField('whatsapp', e.target.value)} className={INPUT_CLASS} placeholder="WhatsApp number" />}
        </Field>
        <Field label="RERA Number" optional>
          {(id) => <Input id={id} value={profile.reraNumber} onChange={(e) => setProfileField('reraNumber', e.target.value)} className={INPUT_CLASS} placeholder="If registered" />}
        </Field>
      </FieldGroup>

      <div className="partner-reg-group px-3 py-3 md:px-4">
        <div className="flex items-start gap-2.5">
          <Checkbox id="agreement" checked={agreementAccepted} onCheckedChange={(v) => setAgreementAccepted(Boolean(v))} className="mt-0.5 h-5 w-5 shrink-0 border-2 border-white/40 bg-slate-900/70 data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-600 data-[state=checked]:text-white" />
          <label htmlFor="agreement" className="partner-reg-label partner-reg-agreement-label leading-snug">
            I agree to the CraftSquare Partner Network terms and consent to lead tracking and communication.
          </label>
        </div>
      </div>

      {message && <p role="alert" className={cn('text-center text-sm font-semibold', message.includes('complete') || message.includes('saved') || message.includes('in!') ? 'text-emerald-400' : 'text-red-400')}>{message}</p>}

      <div className="partner-reg-cta-bar fixed inset-x-0 bottom-0 z-50 space-y-2 border-t border-white/20 px-4 py-2.5 md:static md:z-auto md:border-0 md:px-0 md:py-0">
        <Button type="submit" disabled={loading} className="mx-auto h-11 w-full max-w-md rounded-full bg-orange-600 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-60">
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
        <Button type="button" variant="ghost" onClick={skipStep2} className="mx-auto block w-full max-w-md text-sm text-[#9CA3AF] hover:text-white">
          Skip for now — I&apos;ll complete later
        </Button>
      </div>
      <div className="h-20 md:hidden" aria-hidden="true" />
    </form>
  );
}
