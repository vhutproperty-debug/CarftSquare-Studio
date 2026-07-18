'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BrandLogo from '@/components/BrandLogo';

const INPUT_CLASS = 'mt-1 bg-white text-slate-950';

const PARTNER_SESSION_KEY = 'pn_auth_partner';

export default function PartnerAuthFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';

  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [registerForm, setRegisterForm] = useState({
    fullName: '', mobile: '', email: '', companyName: '',
  });
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [otpMobileKey, setOtpMobileKey] = useState('');
  const [otp, setOtp] = useState('');

  const [partner, setPartner] = useState(null);
  const [profile, setProfile] = useState({
    operatingAreas: '', dealType: 'both', projectsCovered: '', dealsPerMonth: '',
    whatsapp: '', reraNumber: '', city: 'Mumbai', state: 'Maharashtra',
  });
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function persistPartner(nextPartner) {
    if (!nextPartner?.partnerId) return;
    setPartner(nextPartner);
    try {
      sessionStorage.setItem(PARTNER_SESSION_KEY, JSON.stringify(nextPartner));
    } catch {
      // ignore storage errors
    }
  }

  const restorePartnerSession = useCallback(async () => {
    try {
      const res = await fetch('/api/partner-network/auth/session', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.authenticated && data.partner) {
        persistPartner(data.partner);
        return data.partner;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  useEffect(() => {
    if (step !== 'profile') return;
    let cancelled = false;
    restorePartnerSession().then((restored) => {
      if (cancelled || !restored) return;
      setProfile((prev) => ({ ...prev, whatsapp: prev.whatsapp || restored.mobile }));
    });
    return () => {
      cancelled = true;
    };
  }, [step, restorePartnerSession]);

  function setRegisterField(key, value) {
    setRegisterForm((prev) => ({ ...prev, [key]: value }));
  }

  function setProfileField(key, value) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/partner-network/register/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setOtpMobileKey(registerForm.mobile);
      persistPartner({
        partnerId: data.partnerId,
        id: data.id,
        fullName: registerForm.fullName,
        mobile: data.mobile || registerForm.mobile,
        email: data.email || registerForm.email,
        status: data.status || 'pending',
      });
      setStep('otp');
      setMessage(data.message || 'OTP sent to your email.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSendOtp(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/partner-network/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, purpose: 'login' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setOtpMobileKey(data.partnerMobile || loginIdentifier);
      setStep('otp');
      setMessage(data.message || 'OTP sent to your registered email.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/partner-network/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: otpMobileKey, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');
      persistPartner(data.partner);
      if (data.nextStep === 'dashboard') {
        router.push('/partner/dashboard');
        return;
      }
      if (data.nextStep === 'profile') {
        setProfile((prev) => ({ ...prev, whatsapp: prev.whatsapp || data.partner.mobile }));
        setStep('profile');
        setMessage('Email verified. Complete your partner profile to continue.');
        return;
      }
      setStep('pending');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      let activePartner = partner;
      if (!activePartner?.partnerId) {
        activePartner = await restorePartnerSession();
      }
      if (!activePartner?.partnerId) {
        throw new Error('Session expired. Please verify OTP again.');
      }

      const res = await fetch('/api/partner-network/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          partnerId: activePartner.partnerId,
          mobile: activePartner.mobile,
          email: activePartner.email,
          ...profile,
          agreementAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Profile save failed');
      persistPartner({ ...activePartner, ...data, profileCompletionPercent: data.profileCompletionPercent });
      if (data.nextStep === 'dashboard') {
        try { sessionStorage.removeItem(PARTNER_SESSION_KEY); } catch { /* ignore */ }
        router.push('/partner/dashboard');
        return;
      }
      if (activePartner?.status === 'approved') {
        try { sessionStorage.removeItem(PARTNER_SESSION_KEY); } catch { /* ignore */ }
        router.push('/partner/dashboard');
        return;
      }
      setStep('pending');
      setMessage(data.message);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setStep('form');
    setMessage('');
    setOtp('');
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <Link href="/partner"><BrandLogo variant="nav" className="mx-auto" /></Link>
        <h1 className="mt-6 text-2xl font-black">Partner Network</h1>
        <p className="mt-2 text-sm text-slate-400">Secure email OTP authentication</p>
      </div>

      {step === 'form' && (
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}
            onClick={() => switchMode('login')}
          >
            Partner Login
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}
            onClick={() => switchMode('register')}
          >
            Create Partner Account
          </button>
        </div>
      )}

      {step === 'form' && mode === 'login' && (
        <form onSubmit={handleLoginSendOtp} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div>
            <Label className="text-slate-300">Mobile Number or Email</Label>
            <Input
              required
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              className={INPUT_CLASS}
              placeholder="10-digit mobile or email@company.com"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-orange-600 font-bold hover:bg-orange-700">
            {loading ? 'Sending...' : 'Send OTP'}
          </Button>
        </form>
      )}

      {step === 'form' && mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div>
            <Label className="text-slate-300">Full Name</Label>
            <Input required value={registerForm.fullName} onChange={(e) => setRegisterField('fullName', e.target.value)} className={INPUT_CLASS} placeholder="Your full name" />
          </div>
          <div>
            <Label className="text-slate-300">Mobile Number</Label>
            <Input required type="tel" value={registerForm.mobile} onChange={(e) => setRegisterField('mobile', e.target.value)} className={INPUT_CLASS} placeholder="10-digit mobile" />
          </div>
          <div>
            <Label className="text-slate-300">Email Address</Label>
            <Input required type="email" value={registerForm.email} onChange={(e) => setRegisterField('email', e.target.value)} className={INPUT_CLASS} placeholder="you@company.com" />
          </div>
          <div>
            <Label className="text-slate-300">Company Name (optional)</Label>
            <Input value={registerForm.companyName} onChange={(e) => setRegisterField('companyName', e.target.value)} className={INPUT_CLASS} placeholder="Agency or firm" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-orange-600 font-bold hover:bg-orange-700">
            {loading ? 'Creating...' : 'Create Partner Account'}
          </Button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">Verify OTP</p>
          <div>
            <Label className="text-slate-300">Enter 6-digit OTP</Label>
            <Input
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className={`${INPUT_CLASS} text-center text-2xl tracking-widest`}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-orange-600 font-bold hover:bg-orange-700">
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
          <button type="button" className="w-full text-sm text-slate-400 hover:text-white" onClick={() => { setStep('form'); setOtp(''); }}>
            Back
          </button>
        </form>
      )}

      {step === 'profile' && partner && (
        <form onSubmit={handleProfileSave} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-semibold text-orange-300">Partner ID: {partner.partnerId}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Operating Areas</Label>
              <Input value={profile.operatingAreas} onChange={(e) => setProfileField('operatingAreas', e.target.value)} className={INPUT_CLASS} placeholder="Mumbai, Thane" />
            </div>
            <div>
              <Label className="text-slate-300">Deal Type</Label>
              <Select value={profile.dealType} onValueChange={(v) => setProfileField('dealType', v)}>
                <SelectTrigger className={INPUT_CLASS}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rental">Rental</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Deals Per Month</Label>
              <Input value={profile.dealsPerMonth} onChange={(e) => setProfileField('dealsPerMonth', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-300">Projects Covered</Label>
              <Input value={profile.projectsCovered} onChange={(e) => setProfileField('projectsCovered', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <Label className="text-slate-300">City</Label>
              <Input value={profile.city} onChange={(e) => setProfileField('city', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <Label className="text-slate-300">State</Label>
              <Input value={profile.state} onChange={(e) => setProfileField('state', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-slate-300">WhatsApp</Label>
              <Input type="tel" value={profile.whatsapp} onChange={(e) => setProfileField('whatsapp', e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-300">
            <Checkbox checked={agreementAccepted} onCheckedChange={(v) => setAgreementAccepted(Boolean(v))} className="mt-0.5" />
            I agree to the CraftSquare Partner Network terms.
          </label>
          <Button type="submit" disabled={loading} className="w-full bg-orange-600 font-bold hover:bg-orange-700">
            {loading ? 'Saving...' : 'Save Profile & Continue'}
          </Button>
        </form>
      )}

      {step === 'pending' && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-lg font-bold text-emerald-400">Registration Complete</p>
          <p className="text-sm text-slate-300">
            {message || 'Your profile is saved. Our team will review your application and notify you upon approval.'}
          </p>
          {partner?.partnerId && (
            <p className="text-sm text-slate-400">Partner ID: <span className="font-semibold text-orange-300">{partner.partnerId}</span></p>
          )}
          <Button type="button" className="w-full bg-orange-600 font-bold" onClick={() => switchMode('login')}>
            Go to Partner Login
          </Button>
        </div>
      )}

      {message && step !== 'pending' && (
        <p className="text-center text-sm font-semibold text-orange-300">{message}</p>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/partner" className="text-orange-400 hover:underline">← Back to Partner Network</Link>
      </p>
    </div>
  );
}
