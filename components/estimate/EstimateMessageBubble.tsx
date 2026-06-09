import { BRAND } from '@/lib/brand';
import type { ConversationMessage } from '@/lib/estimate/types';

const WELCOME_GREETING = `👋 Welcome to ${BRAND.name}.\n\nI'm your AI Interior Consultant and I'll understand your requirements before generating a personalised estimate.`;

function isWelcomeMessage(content: string) {
  return content.includes('Welcome to') && content.includes('AI');
}

export default function EstimateMessageBubble({
  message,
  isFirst,
}: {
  message: ConversationMessage;
  isFirst?: boolean;
}) {
  const isAssistant = message.role === 'assistant';
  const displayContent = isAssistant && isFirst && isWelcomeMessage(message.content)
    ? WELCOME_GREETING
    : message.content;

  if (!isAssistant) {
    return (
      <div className="estimate-fade-in flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-orange-600 to-orange-500 px-5 py-3.5 text-sm leading-6 text-white shadow-lg shadow-orange-600/20 sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="estimate-fade-in flex justify-start">
      <div className="max-w-[92%] sm:max-w-[85%]">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-black text-white shadow-md">
            AI
          </div>
          <span className="text-xs font-bold text-slate-500">Your Interior Consultant</span>
        </div>
        <div className="whitespace-pre-wrap rounded-2xl rounded-tl-md border border-slate-100/80 bg-white/95 px-5 py-4 text-sm leading-7 text-slate-700 shadow-sm">
          {displayContent}
        </div>
      </div>
    </div>
  );
}
