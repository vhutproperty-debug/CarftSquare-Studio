'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { applyPropertyPurposeAnswer } from '@/lib/estimate/modules/qualification';
import type { ConversationMessage, EstimateAnswers, EstimateModuleId, ProjectSummary, PropertyPurpose } from '@/lib/estimate/types';
import EstimateAnalyzing from './EstimateAnalyzing';
import EstimateLeadCapture from './EstimateLeadCapture';
import EstimateMessageBubble from './EstimateMessageBubble';
import EstimateProgress, { getEstimateProgress } from './EstimateProgress';
import EstimateSelectionCards from './EstimateSelectionCards';
import EstimateSummaryPreview from './EstimateSummaryPreview';
import EstimateTypingIndicator from './EstimateTypingIndicator';

type Phase = 'discovery' | 'summary' | 'lead' | 'complete';

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

  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  const progress = getEstimateProgress(answeredCount, phase);

  async function sendChat(payload: {
    answers: EstimateAnswers;
    conversation: ConversationMessage[];
    userMessage?: string;
    phase?: Phase;
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
      if (data.summary) setSummary(data.summary);
      if (data.activeModuleId) setActiveModuleId(data.activeModuleId);
      if (data.propertyPurpose) setPropertyPurpose(data.propertyPurpose);
      if (data.phase === 'summary') {
        setPhase('summary');
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

  function applyAnswer(value: string) {
    if (!nextQuestion || analyzing || loading) return;

    let updated: EstimateAnswers = {
      ...answers,
      [nextQuestion.id]: nextQuestion.type === 'number' ? Number(value) : value,
    };
    if (nextQuestion.id === 'propertyPurpose') {
      updated = applyPropertyPurposeAnswer(updated, value);
    }

    setSelectedOption(value);
    setShowQuestion(false);
    setAnalyzing(true);

    setTimeout(() => {
      setAnalyzing(false);
      setShowTyping(true);
      setAnswers(updated);
      setInput('');
      sendChat({ answers: updated, conversation, userMessage: value });
    }, 800);
  }

  async function generateQuote(lead: { name: string; phone: string; whatsapp: string; email: string }) {
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
          whatsapp: lead.whatsapp || lead.phone,
          email: lead.email,
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

  const showInputArea = phase === 'discovery' && nextQuestion && showQuestion && !analyzing && !loading && !showTyping;

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
                <p className="text-center text-sm font-semibold text-slate-500">{nextQuestion.text}</p>
                <EstimateSelectionCards
                  questionId={nextQuestion.id}
                  options={nextQuestion.options}
                  selected={selectedOption}
                  onSelect={applyAnswer}
                />
              </div>
            )}

            {showInputArea && !nextQuestion.options && (
              <div key={questionKey} className="mt-8 space-y-5 border-t border-slate-100/80 pt-8 estimate-fade-in-up">
                <p className="text-center text-sm font-semibold text-slate-500">{nextQuestion.text}</p>
                <form
                  className="flex flex-col gap-4 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) applyAnswer(input.trim());
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

            {phase === 'summary' && summary && (
              <div className="mt-8 space-y-6 border-t border-slate-100/80 pt-8">
                <EstimateSummaryPreview summary={summary} propertyPurpose={propertyPurpose} />
                <Button
                  className="h-14 w-full rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 font-black text-white shadow-lg shadow-orange-600/25 transition hover:from-orange-700 hover:to-orange-600"
                  onClick={() => setPhase('lead')}
                >
                  Generate My AI Interior Report <ArrowRight className="ml-2 h-5 w-5" />
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
