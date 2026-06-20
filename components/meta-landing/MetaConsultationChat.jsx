'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CONSULTATION_STEPS,
  CONTACT_ACK_MESSAGE,
  META_LANDING_PATH,
  WELCOME_MESSAGE,
  formatConsultationSummary,
  mapProjectType,
} from '@/lib/meta-landing/consultation-flow';
import {
  META_LANDING_PHONE,
  META_LANDING_WHATSAPP,
  SUCCESS_BENEFITS,
} from '@/lib/meta-landing/content';
import { splitFullName, trackLeadFromSource } from '@/lib/meta-pixel';
import { GA_EVENTS, trackGaEvent } from '@/lib/analytics/ga4';
import { INDIAN_MOBILE_ERROR, isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';

function nowIso() {
  return new Date().toISOString();
}

function TypingIndicator() {
  return (
    <div className="meta-msg-in flex justify-start">
      <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          CraftSquare AI is typing
          <span className="ml-1 inline-flex gap-0.5">
            <span className="meta-dot inline-block h-1 w-1 rounded-full bg-orange-400" />
            <span className="meta-dot inline-block h-1 w-1 rounded-full bg-orange-400" />
            <span className="meta-dot inline-block h-1 w-1 rounded-full bg-orange-400" />
          </span>
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }) {
  const isAssistant = role === 'assistant';

  if (!isAssistant) {
    return (
      <div className="meta-msg-in flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-orange-600 to-orange-500 px-5 py-3.5 text-sm leading-6 text-white shadow-lg shadow-orange-600/20">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="meta-msg-in flex justify-start">
      <div className="max-w-[92%]">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-black text-white shadow-md">
            AI
          </div>
          <span className="text-xs font-bold text-slate-500">Your Interior Consultant</span>
        </div>
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-slate-100 bg-white px-5 py-4 text-sm leading-7 text-slate-700 shadow-sm">
          {content}
        </div>
      </div>
    </div>
  );
}

function SuccessScreen() {
  return (
    <div className="border-t border-slate-200 bg-white p-6 md:p-8">
      <p className="text-2xl font-black text-slate-950">🎉 Thank you!</p>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Our design team will prepare your personalized estimate and contact you shortly.
      </p>
      <p className="mt-6 text-sm font-bold text-slate-800">You will receive:</p>
      <ul className="mt-3 space-y-2">
        {SUCCESS_BENEFITS.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Check className="h-4 w-4 shrink-0 text-orange-600" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href={`tel:${META_LANDING_PHONE}`} className="inline-flex flex-1">
          <Button type="button" className="h-14 w-full rounded-2xl bg-orange-600 font-black text-white hover:bg-orange-700">
            Book Free Consultation
          </Button>
        </a>
        <a href={META_LANDING_WHATSAPP} target="_blank" rel="noreferrer" className="inline-flex flex-1">
          <Button
            type="button"
            variant="outline"
            className="h-14 w-full rounded-2xl border-emerald-200 font-black text-emerald-800 hover:bg-emerald-50"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Chat on WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}

export default function MetaConsultationChat({ active, onStarted }) {
  const [messages, setMessages] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [textInput, setTextInput] = useState('');
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [typing, setTyping] = useState(false);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const conversationRef = useRef([]);
  const initializedRef = useRef(false);

  const step = CONSULTATION_STEPS[stepIndex];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const pushMessage = useCallback((role, content) => {
    const entry = { role, content, timestamp: nowIso() };
    conversationRef.current = [...conversationRef.current, entry];
    setMessages((current) => [...current, entry]);
  }, []);

  const advanceWithAssistant = useCallback(async (nextIndex) => {
    setTyping(true);
    scrollToBottom();
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      if (nextIndex >= CONSULTATION_STEPS.length) {
        setComplete(true);
        scrollToBottom();
        return;
      }
      pushMessage('assistant', CONSULTATION_STEPS[nextIndex].assistant);
      setStepIndex(nextIndex);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setTyping(false);
    }
  }, [pushMessage, scrollToBottom]);

  useEffect(() => {
    if (!active || initializedRef.current) return;
    initializedRef.current = true;
    onStarted?.();
    conversationRef.current = [];
    pushMessage('assistant', WELCOME_MESSAGE);
    setTyping(true);
    const timer = window.setTimeout(() => {
      setTyping(false);
      pushMessage('assistant', CONSULTATION_STEPS[0].assistant);
      setStepIndex(0);
      scrollToBottom();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [active, onStarted, pushMessage, scrollToBottom]);

  useEffect(() => {
    if (!typing) return undefined;
    const safetyTimer = window.setTimeout(() => setTyping(false), 8000);
    return () => window.clearTimeout(safetyTimer);
  }, [typing]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, complete, scrollToBottom]);

  async function submitLead(finalAnswers, conversation) {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/designer-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalAnswers.name,
          phone: finalAnswers.phone,
          city: finalAnswers.city || '',
          projectType: mapProjectType(finalAnswers),
          message: formatConsultationSummary(finalAnswers),
          landingPage: META_LANDING_PATH,
          fromAiChat: true,
          aiContext: {
            moduleId: 'meta-ads-landing',
            phase: 'complete',
            projectCategory: mapProjectType(finalAnswers),
            answers: finalAnswers,
            conversation,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit your request.');

      trackGaEvent(GA_EVENTS.CONTACT_FORM_SUBMITTED, {
        source: 'meta_ads_landing',
        form_location: META_LANDING_PATH,
        project_type: mapProjectType(finalAnswers),
      });
      const { firstName, lastName } = splitFullName(finalAnswers.name);
      trackLeadFromSource(
        'ai_interior_consultant',
        {
          form_source: 'meta_ads_landing',
          landing_page: META_LANDING_PATH,
        },
        { phone: finalAnswers.phone, firstName, lastName },
      );

      setComplete(true);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTextSubmit(event) {
    event.preventDefault();
    if (!step || typing || complete || submitting) return;
    const value = textInput.trim();
    if (!value) return;

    pushMessage('user', value);
    setTextInput('');
    const nextAnswers = { ...answers, [step.id]: value };
    setAnswers(nextAnswers);

    if (step.isFinal) {
      await submitLead(nextAnswers, conversationRef.current);
      return;
    }
    await advanceWithAssistant(stepIndex + 1);
  }

  async function handleOptionSelect(value) {
    if (!step || typing || complete || submitting) return;
    pushMessage('user', value);
    const nextAnswers = { ...answers, [step.id]: value };
    setAnswers(nextAnswers);

    if (step.isFinal) {
      await submitLead(nextAnswers, conversationRef.current);
      return;
    }
    await advanceWithAssistant(stepIndex + 1);
  }

  async function handleContactSubmit(event) {
    event.preventDefault();
    if (!step || typing || complete || submitting) return;

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('contactName') ?? contact.name).trim();
    const phoneRaw = String(formData.get('contactPhone') ?? contact.phone).trim();

    if (name.length < 2) {
      setError('Please enter your full name.');
      return;
    }

    const digits = normalizeIndianMobile(phoneRaw);
    if (!isValidIndianMobile(digits)) {
      setError(INDIAN_MOBILE_ERROR);
      return;
    }

    pushMessage('user', `${name} · ${digits}`);
    const nextAnswers = { ...answers, name, phone: digits };
    setAnswers(nextAnswers);
    setContact({ name, phone: digits });
    setError('');

    if (step.earlyCapture) {
      setTyping(true);
      scrollToBottom();
      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        pushMessage('assistant', CONTACT_ACK_MESSAGE(name.split(' ')[0]));
        await advanceWithAssistant(stepIndex + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setTyping(false);
      }
      return;
    }

    await submitLead(nextAnswers, conversationRef.current);
  }

  if (!active) {
    return (
      <div className="meta-chat-panel rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-500">Your AI Interior Consultant is ready.</p>
        <p className="mt-2 text-lg font-black text-slate-900">Tap a button above to start your free consultation.</p>
      </div>
    );
  }

  return (
    <div className="meta-chat-panel overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
      <div ref={scrollRef} className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto px-4 py-6 md:px-6">
        {messages.map((message, index) => (
          <MessageBubble key={`${message.timestamp}-${index}`} role={message.role} content={message.content} />
        ))}
        {typing && <TypingIndicator />}
      </div>

      {!complete && step && !typing && (
        <div className="border-t border-slate-200 bg-white p-4 md:p-6">
          {step.type === 'text' && (
            <form onSubmit={handleTextSubmit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder={step.placeholder}
                inputMode={step.inputMode || 'text'}
                className="meta-chat-input h-14 flex-1 rounded-2xl border-slate-200 bg-white px-5 text-base font-medium text-[#111827] placeholder:text-[#9CA3AF] caret-[#F97316] md:text-base"
                autoFocus
              />
              <Button type="submit" disabled={submitting} className="h-14 rounded-2xl bg-orange-600 px-6 font-black text-white hover:bg-orange-700">
                Continue <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          )}

          {step.type === 'options' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {step.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleOptionSelect(option)}
                  className="meta-option-btn rounded-2xl border-2 border-slate-100 bg-white px-5 py-4 text-left text-sm font-bold text-slate-800 transition hover:border-orange-200 disabled:opacity-60"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {step.type === 'contact' && (
            <form onSubmit={handleContactSubmit} className="grid gap-4">
              <Input
                name="contactName"
                value={contact.name}
                onChange={(event) => {
                  setContact((current) => ({ ...current, name: event.target.value }));
                  if (error) setError('');
                }}
                placeholder="Full name *"
                autoComplete="name"
                className="meta-chat-input h-14 rounded-2xl border-slate-200 bg-white px-5 text-base font-medium text-[#111827] placeholder:text-[#9CA3AF] caret-[#F97316] md:text-base"
                autoFocus
              />
              <Input
                name="contactPhone"
                type="tel"
                value={contact.phone}
                onChange={(event) => {
                  setContact((current) => ({ ...current, phone: event.target.value }));
                  if (error) setError('');
                }}
                placeholder="Mobile number *"
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
                className="meta-chat-input h-14 rounded-2xl border-slate-200 bg-white px-5 text-base font-medium text-[#111827] placeholder:text-[#9CA3AF] caret-[#F97316] md:text-base"
              />
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <Button
                type="submit"
                disabled={submitting}
                className="h-14 rounded-2xl bg-orange-600 font-black text-white hover:bg-orange-700"
              >
                {submitting ? 'Saving…' : (step.submitLabel || 'Continue')}
                {!submitting && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
            </form>
          )}
        </div>
      )}

      {complete && <SuccessScreen />}
    </div>
  );
}
