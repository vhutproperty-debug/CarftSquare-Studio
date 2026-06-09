'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ConversationMessage, EstimateAnswers, EstimateModuleId, ProjectSummary, PropertyPurpose } from '@/lib/estimate/types';
import EstimateAnalyzing from './EstimateAnalyzing';
import EstimateLeadCapture from './EstimateLeadCapture';
import EstimateMessageBubble from './EstimateMessageBubble';
import EstimateProgress, { getEstimateProgress } from './EstimateProgress';
import EstimateSelectionCards from './EstimateSelectionCards';
import EstimateSummaryPreview from './EstimateSummaryPreview';
import EstimateTypingIndicator from './EstimateTypingIndicator';

type Phase = 'discovery' | 'summary' | 'lead_prompt' | 'lead' | 'followup' | 'complete';

type PricingPreview = {
  formattedRange: string;
  estimateLow: number;
  estimateHigh: number;
  recommendedPackage: string;
  styleRecommendation: string;
  timelineWeeks: string;
  recommendedAddons: string[];
};

export default function EstimateChat({
  moduleId,
  landingPage,
  leadSource = 'ai-estimate',
  campaignName = '',
}: {
  moduleId: EstimateModuleId;
  landingPage: string;
  leadSource?: string;
  campaignName?: string;
}) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('discovery');
  const [answers, setAnswers] = useState<EstimateAnswers>({});
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [nextQuestion, setNextQuestion] = useState<{ id: string; text: string; options?: string[]; type: string } | null>(null);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<EstimateModuleId>(moduleId);
  const [propertyPurpose, setPropertyPurpose] = useState<PropertyPurpose | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [showQuestion, setShowQuestion] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [questionKey, setQuestionKey] = useState(0);

  const answeredCount = Object.keys(answers).filter((k) => {
    if (k === 'propertyPurposeRaw') return false;
    const v = answers[k];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
  const progress = getEstimateProgress(answeredCount, phase);

  async function sendChat(payload: {
    answers: EstimateAnswers;
    conversation: ConversationMessage[];
    userMessage?: string;
    phase?: Phase;
    activeFieldId?: string;
  }) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/estimate/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          answers: payload.answers,
          conversation: payload.conversation,
          userMessage: payload.userMessage,
          phase: payload.phase || phase,
          activeFieldId: payload.activeFieldId,
          leadSource,
          campaignName,
          landingPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      await new Promise((resolve) => setTimeout(resolve, 900));

      setShowTyping(false);
      setConversation(data.conversation);
      setNextQuestion(data.nextQuestion);
      if (data.answers) setAnswers(data.answers);
      if (data.summary) setSummary(data.summary);
      if (data.pricing) setPricing(data.pricing);
      if (data.activeModuleId) setActiveModuleId(data.activeModuleId);
      if (data.propertyPurpose) setPropertyPurpose(data.propertyPurpose);

      if (data.phase === 'summary') {
        setPhase('lead_prompt');
        setShowQuestion(false);
      } else if (data.phase === 'followup') {
        setPhase('followup');
        setShowQuestion(false);
      } else {
        setQuestionKey((k) => k + 1);
        setShowQuestion(true);
        setSelectedOption(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setShowTyping(false);
      setShowQuestion(true);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    setShowTyping(true);
    sendChat({ answers: {}, conversation: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, phase, loading, analyzing, showTyping, showQuestion]);

  function submitAnswer(value: string, fieldId?: string) {
    if (!value.trim() || analyzing || loading) return;

    setSelectedOption(value);
    setShowQuestion(false);
    setAnalyzing(true);

    setTimeout(() => {
      setAnalyzing(false);
      setShowTyping(true);
      setInput('');
      sendChat({
        answers,
        conversation,
        userMessage: value.trim(),
        activeFieldId: fieldId || nextQuestion?.id,
      });
    }, 800);
  }

  function applyAnswer(value: string) {
    if (!nextQuestion || analyzing || loading) return;
    submitAnswer(value, nextQuestion.id);
  }

  async function generateQuote(lead: { name: string; phone: string }) {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/estimate/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          answers,
          conversation,
          name: lead.name,
          phone: lead.phone,
          whatsapp: lead.phone,
          email: '',
          leadSource,
          campaignName,
          landingPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Quote failed');
      router.push(`/estimate/result/${data.quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate quotation');
    } finally {
      setSubmitting(false);
    }
  }

  const showInputArea =
    phase === 'discovery' && nextQuestion && showQuestion && !analyzing && !loading && !showTyping;

  return (
    <>
      <EstimateProgress step={progress.step} percent={progress.percent} />

      <div className="relative mx-auto max-w-3xl">
        <div className="estimate-scale-in estimate-glass-card rounded-[2rem] p-6 md:rounded-[2.5rem] md:p-10">
          <div className="flex min-h-[420px] flex-col md:min-h-[480px]">
            <div className="flex-1 space-y-6 overflow-y-auto pr-1" aria-live="polite">
              {conversation.map((message, index) => (
                <EstimateMessageBubble
                  key={`${message.timestamp}-${index}`}
                  message={message}
                  isFirst={index === 0 && message.role === 'assistant'}
                />
              ))}

              {analyzing && <EstimateAnalyzing />}
              {(showTyping || loading) && !analyzing && <EstimateTypingIndicator />}

              <div ref={bottomRef} />
            </div>

            {showInputArea && nextQuestion.options && (
              <div key={questionKey} className="mt-8 space-y-5 border-t border-slate-100/80 pt-8 estimate-fade-in-up">
                <EstimateSelectionCards
                  questionId={nextQuestion.id}
                  options={nextQuestion.options}
                  selected={selectedOption}
                  onSelect={applyAnswer}
                />
                <form
                  className="flex flex-col gap-4 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) submitAnswer(input.trim(), nextQuestion.id);
                  }}
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Or type your answer naturally..."
                    className="h-14 flex-1 rounded-2xl border-slate-200 px-5 text-base"
                  />
                  <Button
                    type="submit"
                    className="h-14 rounded-2xl bg-orange-600 px-8 font-black text-white hover:bg-orange-700"
                  >
                    Send <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}

            {showInputArea && !nextQuestion.options && (
              <div key={questionKey} className="mt-8 space-y-5 border-t border-slate-100/80 pt-8 estimate-fade-in-up">
                <form
                  className="flex flex-col gap-4 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) submitAnswer(input.trim(), nextQuestion.id);
                  }}
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={nextQuestion.type === 'number' ? 'Enter area in sq.ft' : 'Share your thoughts...'}
                    className="h-14 flex-1 rounded-2xl border-slate-200 px-5 text-base"
                  />
                  <Button
                    type="submit"
                    className="h-14 rounded-2xl bg-orange-600 px-8 font-black text-white hover:bg-orange-700"
                  >
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}

            {(phase === 'lead_prompt' || phase === 'summary') && summary && (
              <div className="mt-8 space-y-6 border-t border-slate-100/80 pt-8">
                <EstimateSummaryPreview
                  summary={summary}
                  propertyPurpose={propertyPurpose}
                  budgetRange={pricing?.formattedRange}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="h-14 flex-1 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 font-black text-white shadow-lg shadow-orange-600/25 transition hover:from-orange-700 hover:to-orange-600"
                    onClick={() => setPhase('lead')}
                  >
                    Yes, Contact Me
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 flex-1 rounded-2xl border-slate-200 font-bold text-slate-700"
                    onClick={() => {
                      setPhase('followup');
                      setShowQuestion(false);
                      setConversation((prev) => [
                        ...prev,
                        {
                          role: 'assistant',
                          content: "Of course — feel free to ask me anything about your interior project. What would you like to explore?",
                          timestamp: new Date().toISOString(),
                        },
                      ]);
                    }}
                  >
                    Continue with AI
                  </Button>
                </div>
              </div>
            )}

            {phase === 'followup' && !loading && !showTyping && (
              <div className="mt-8 space-y-5 border-t border-slate-100/80 pt-8 estimate-fade-in-up">
                <form
                  className="flex flex-col gap-4 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) {
                      setShowTyping(true);
                      sendChat({ answers, conversation, userMessage: input.trim(), phase: 'followup' });
                      setInput('');
                    }
                  }}
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about design, materials, storage..."
                    className="h-14 flex-1 rounded-2xl border-slate-200 px-5 text-base"
                  />
                  <Button
                    type="submit"
                    className="h-14 rounded-2xl bg-orange-600 px-8 font-black text-white hover:bg-orange-700"
                  >
                    Ask <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-slate-200 font-bold text-slate-700"
                  onClick={() => setPhase('lead')}
                >
                  Yes, Contact Me
                </Button>
              </div>
            )}

            {error && <p className="mt-4 text-center text-sm font-semibold text-red-600">{error}</p>}
          </div>
        </div>

        {phase === 'lead' && (
          <div className="estimate-fade-in-up mt-8">
            <EstimateLeadCapture onSubmit={generateQuote} loading={submitting} />
          </div>
        )}
      </div>
    </>
  );
}
